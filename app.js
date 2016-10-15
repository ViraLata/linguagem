
/* jshint node: true, devel: true */
'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request');

//librerias base de datos
var query = require('pg-query');
var Promise = require("bluebird");
var pgp = require('pg-promise')();

//textos
var lang  = require('./lang.json');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

//importamos los niveles
var niveles = require('./niveles').niveles;


var promise = require('bluebird'); // or any other Promise/A+ compatible library;
var options = {
    promiseLib: promise // overriding the default (ES6 Promise);
};
var pgp = require('pg-promise')(options);

var cn = {
    host: 'localhost', // 'localhost' is the default;
    port: 5432, // 5432 is the default; 
    database: 'linguagem',
    user: 'postgres',
    password: ''
};



var db = pgp(cn); // database instance; 



var heads_ok_pt = [':) Continue assim!', ':) E isso ai!', ':) Certa resposta!', ':) Correto!', ':) Golaço!', ':) Que esperto!', ':) Que inteligente!', ':)  Mais uma certa!', ':) Arrasou!', ':) Beleza!']; 
var heads_ko_pt = [':( Acredite em você!', ':( Tente outra vez!', ':( Persista!', ':( Confio em você!', ':( Não desanime!', ':( Foco!', ':( Fala serio!', ':( Foco, força e fe!', 'Você consegue!', 'Animo!']; 

var heads_ok_es = [':) Continua así!', ':) Perfecto!', ':) Muy bien!', ':) Correcto!', ':) Golazo!', ':) Que experto!', ':) Que inteligente', ':) Una más correcta!', ':) Vas bien!', ':) mejor imposible!', ':) Súper bien!', ':) Genial!'];
var heads_ko_es = [':( Intenta con esta!', ':( Le pasa a cualquiera!', ':( Vamos! Vos podes!', ':( Venias re bien!', ':( No te desanimes!', ':( Vamos de nuevo!', ':( Esta es fácil!', ':( Retroceder nunca, rendirse jamás!', ':( Casi!', ':( Animo!']; 

var heads_ok_en = [':) perfect!', ':) cool!', ':) awesome!', ':) breathtaking!', ':) majestic!', ':) like a boss!', ':) smart guy', ':) one more!'];
var heads_ko_en = [':( sad!', ':( wrong!', ':( next try!', ':( too bad!', ':( really?']; 




//console.log(parseInt(81 / 10, 10) * 10)
/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? 
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query['account_linking_token'];
  var redirectURI = req.query['redirect_uri'];

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;


  getInsertUserFbid(senderID)
  .then(function (userId) {

    if (isEcho) {
      // Just logging message echoes to console
      console.log("Received echo for message %s and app %d with metadata %s", 
        messageId, appId, metadata);
      return;
    } else if (quickReply) {

      var quickReplyPayload = quickReply.payload;
      console.log("Quick reply for message %s with payload %s",
        messageId, quickReplyPayload);
      
      sendTextMessage(senderID, "Quick reply tapped");
   
      return;
    }
  
    if (messageText) {
  
  
    console.log("userid="+userId.id+" id="+senderID) 
    if(userId.lang == 0 || userId.lang === undefined ) {
      sendLang(senderID)
    } else {
      //tenemos idioma, mandamos el menu
      sendLang(senderID)
    }
  
  
    } else if (messageAttachments) {
      sendTextMessage(senderID, "Message with attachment received");
    }


  })
  .catch(function (error) {
      // something went wrong;
      console.log('fallo getInsertUserFbid message')
  }); 

  
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;


  var payload = event.postback.payload;



  console.log("Received postback for user %d and page %d with payload '%s' " + 
   "at %d", senderID, recipientID, payload, timeOfPostback);


  getInsertUserFbid(senderID)
  .then(function (userId) {
    console.log("receivedPostback userid="+userId.id+" id="+senderID) 
    var nivel_pt = userId.nivel_pt
    var nivel_es = userId.nivel_es
    var nivel_en = userId.nivel_en
    console.log("nivel_pt="+nivel_pt+" nivel_es="+nivel_es+' nivel_en='+nivel_en) 
    
    var idioma = lang.pt
    var conflang = 'pt'
    var head_ok = heads_ok_pt[Math.floor(Math.random()*heads_ok_pt.length)]
    var head_ko = heads_ko_pt[Math.floor(Math.random()*heads_ok_pt.length)]
    //var nivel_actual;


    switch (userId.lang) {
      case 1:
        var nivel_actual = nivel_pt
        idioma = lang.pt
        conflang = 'pt'
        head_ok = heads_ok_pt[Math.floor(Math.random()*heads_ok_pt.length)]
        head_ko = heads_ko_pt[Math.floor(Math.random()*heads_ok_pt.length)]
      break;
      case 2:
        var nivel_actual = nivel_es
        idioma = lang.es
        conflang = 'es'
        head_ok = heads_ok_es[Math.floor(Math.random()*heads_ok_es.length)]
        head_ko = heads_ko_es[Math.floor(Math.random()*heads_ok_es.length)]
      break;
      case 3:
        var nivel_actual = nivel_en
        idioma = lang.en
        conflang = 'en'
        head_ok = heads_ok_en[Math.floor(Math.random()*heads_ok_en.length)]
        head_ko = heads_ko_en[Math.floor(Math.random()*heads_ok_en.length)]
      break;
    }

    if (payload == 'pt') {
      //el usuario eligio portugues
      InsertLangbyid(userId.id,1);
      sendPregunta(senderID, 1, idioma.msg_foot, nivel_actual)
    } else if (payload == 'es') {
        //el usuario eligio espanol
        InsertLangbyid(userId.id,2);
        sendPregunta(senderID, 2, idioma.msg_foot, nivel_actual)
 } else if (payload == 'en') {
        //el usuario eligio ingles
        InsertLangbyid(userId.id,3);
        sendPregunta(senderID, 3, idioma.msg_foot, nivel_actual)
    } else if (payload == 'sendlang') {
      sendLang(senderID);
    } else {
        var idpostback = payload.substring(payload.lastIndexOf("$")+1,payload.lastIndexOf("_"))
        var respuesta_call = payload.substring(payload.lastIndexOf("_")+1,payload.lastIndexOf("%"))
        console.log("idpostback = %s respuesta_call = %s",
          idpostback, respuesta_call);
        if (nivel_actual >= 951) {
          if (respuesta_call == 'ok') {
            var cabeza = head_ok+idioma.msg_foot;
            sendPregunta(senderID, userId.lang, cabeza, nivel_actual)
          } else if (respuesta_call == 'ko') {
            var cabeza = head_ko+idioma.msg_foot;
            sendPregunta(senderID, userId.lang, cabeza, nivel_actual)
          }
        }
        else if (nivel_actual == idpostback) {
          //el usuario esta respondiendo la pregunta correcta
          if (respuesta_call == 'ok') {
            //la pregunta es correcta
            console.log("OK");
            var proximo_nivel = parseInt(nivel_actual / 10, 10) * 10 + 10;  
            var nivel_actual = nivel_actual+1;
            var cabeza = nivel_actual+'/'+proximo_nivel+' '+head_ok+' '+idioma.msg_foot;
            //guardamos el proximo nivel
            InsertNivelbyid (userId.id,nivel_actual, userId.lang);
            //enviamos la proxima pregunta
            sendPregunta(senderID, userId.lang, cabeza, nivel_actual)

          } else if (respuesta_call == 'ko') {
            console.log("KO");
            //la respuesta es incorrecta
            var cabeza = head_ko+idioma.msg_foot;
            //reseteamos el nivel
            var nivel_actual = parseInt(nivel_actual / 10, 10) * 10;
            if (nivel_actual == 0) nivel_actual = 1; //pequeño solucion a bug, no existe pregunta con id 0
            InsertNivelbyid (userId.id,nivel_actual, userId.lang);
            //enviamos la primera pregunta del nivel
            sendPregunta(senderID, userId.lang, cabeza, nivel_actual, 1)
          }

        } else {
          //el usuario esta respondiendo una respuesta anterior
          console.log("CHEATING");
          sendPregunta(senderID, userId.lang, idioma.cheating, nivel_actual, 1)
        }

    }

  })
  .catch(function (error) {
      // something went wrong;
      console.log('fallo getInsertUserFbid message')
  }); 

}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}


/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId, titulo, texto1, pay1, texto2, pay2, texto3, pay3) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: titulo,
      metadata: "DEVELOPER_DEFINED_METADATA",
      quick_replies: [
        {
          "content_type":"text",
          "title":texto1,
          "payload":pay1
        },
        {
          "content_type":"text",
          "title":texto2,
          "payload":pay2
        },
        {
          "content_type":"text",
          "title":texto3,
          "payload":pay3
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}


/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error(response.error);
    }
  });  
}

//funciones propias



function getInsertUserFbid(idfb) {
    return db.task(function (t) {
            return t.oneOrNone('SELECT id, idfb, nivel, lang, id_last_mo, puntos, nivel_es, nivel_en, nivel_pt FROM public.lingua_usuarios WHERE idfb = $1', idfb)
                .then(function (user) {
                    return user || t.one('INSERT INTO public.lingua_usuarios(idfb, date_added) VALUES($1, $2) RETURNING id', [idfb, new Date()]);
                });
        })
        .then(function (user) {
            return user;
        }).catch(function (error) {
        console.log("ERROR:", error);
    });
}

function sendLang(sender) {

  var messageData = {
    recipient: {
      id: sender
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: lang.pt.welcome_message,
          buttons:[{
            type: "postback",
            title: lang.pt.btn_pt,
            payload : "pt"
          }, {
            type: "postback",
            title: lang.pt.btn_es,
            payload : "es"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function InsertLangbyid(id,lang) {
    db.none("UPDATE public.lingua_usuarios SET lang = $1, date_last_mod = $3 WHERE id = $2", [lang, id, new Date()])
    .then(function () {
        console.log('Lang guardado');
    })
    .catch(function (error) {
        console.log("ERROR:", error);
    });
}




function sendPregunta(sender, idioma, cabeza, idPregunta, mala) {
  var campo = "esp";
  //var idPregunta = randomInt(3,900);
  if (idPregunta == 0) idPregunta = 1;

  console.log("sendPregunta="+idPregunta);
  if (idioma == 1) {
    campo = 'prt'
  } else if (idioma == 2) {
    campo = 'esp'
  } else if (idioma == 3) {
    campo = 'ing'
  }
  console.log("campo="+campo);


  if (idPregunta >= 951) {
    idPregunta = randomInt(1,950);
    console.log("final! idPregunta="+idPregunta);
  }


  console.log("query= "+"SELECT id, ing, "+campo+" as correcta, n , (SELECT "+campo+" from palabras where id != "+idPregunta+" ORDER BY RANDOM() limit 1) as mala1, (SELECT "+campo+" from palabras where id != "+idPregunta+" ORDER BY RANDOM() limit 1) as mala2 FROM palabras WHERE id = "+idPregunta);
  db.one("SELECT id, ing, "+campo+" as correcta, n , (SELECT "+campo+" from palabras where id != "+idPregunta+" ORDER BY RANDOM() limit 1) as mala1, (SELECT "+campo+" from palabras where id != "+idPregunta+" ORDER BY RANDOM() limit 1) as mala2, imgurl FROM palabras WHERE id = "+idPregunta, true)
  .then(function (data) {
    console.log("pregunta:"+data.ing+" imgurl= "+data.imgurl);
    //enviamos la pregunta

    switch (randomInt(1,4)) {
      case 1:
      var respuesta_1 = data.correcta
      var respuesta_2 = data.mala1
      var respuesta_3 = data.mala2
      var payload_1 = '$'+data.id+"_ok%"
      var payload_2 = '$'+data.id+"_ko%"
      var payload_3 = '$'+data.id+"_ko%"
      break;
      case 2:
      var respuesta_1 = data.mala1
      var respuesta_2 = data.correcta
      var respuesta_3 = data.mala2
      var payload_1 = '$'+data.id+"_ko%"
      var payload_2 = '$'+data.id+"_ok%"
      var payload_3 = '$'+data.id+"_ko%"
      break;
      case 3:
      var respuesta_1 = data.mala1
      var respuesta_2 = data.mala2
      var respuesta_3 = data.correcta
      var payload_1 = '$'+data.id+"_ko%"
      var payload_2 = '$'+data.id+"_ko%"
      var payload_3 = '$'+data.id+"_ok%"
      break;
    }    

    var pregunta = cabeza+", "+data.ing
    //sendQuickReply(sender, pregunta, respuesta_1, payload_1, respuesta_2, payload_2, respuesta_3, payload_3)
    //CheckLevelUp(sender, idPregunta)

    //buscamos en el array de niveles, así averiguamos si subio de nivel
    var picked = niveles.find(o => o.n === idPregunta);

    if (mala == 1) {
      //enviamos un mensaje comun, el usuario equivoco
      send3Buttons(sender, pregunta, respuesta_1, payload_1, respuesta_2, payload_2, respuesta_3,payload_3);
    }
    else if (idPregunta >= 951) {
      send3Buttons(sender, pregunta, respuesta_1, payload_1, respuesta_2, payload_2, respuesta_3,payload_3)
    }
    else if ( typeof picked !== 'undefined' && query )
    {
      //el usuario subio de nivel
      sendLevelUp(sender, data.imgurl, pregunta, respuesta_1, payload_1, respuesta_2, payload_2, respuesta_3,payload_3)
      //send3Buttons(sender, pregunta, respuesta_1, payload_1, respuesta_2, payload_2, respuesta_3,payload_3)
    }
    else
    {
      //no subio de nivel
      send3Buttons(sender, pregunta, respuesta_1, payload_1, respuesta_2, payload_2, respuesta_3,payload_3)
    }


    
  }) //fin del db
    .catch(function (error) {
        console.log('Error: ', error)
    });

}

function send3Buttons(recipientId, titulo, texto1, pay1, texto2, pay2, texto3,pay3) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: titulo,
          buttons:[{
            type: "postback",
            title: texto1,
            payload: pay1
          }, {
            type: "postback",
            title: texto2,
            payload: pay2
          }, {
            type: "postback",
            title: texto3,
            payload: pay3
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendLevelUp(recipientId, urlgif, titulo, texto1, pay1, texto2, pay2, texto3,pay3) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Level up! "+titulo,
            subtitle: ":D",
            item_url: "http://www.linguagem.co",               
            image_url: urlgif,
            buttons: [{
              type: "postback",
              title: texto1,
              payload: pay1
            }, {
              type: "postback",
              title: texto2,
              payload: pay2,
            }, {
              type: "postback",
              title: texto3,
              payload: pay3,
            }],
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function InsertNivelbyid(id,nivel,lang) {
    var campo_nivel;

    switch (lang) {
      case 1:
        campo_nivel = 'nivel_pt'
      break;
      case 2:
        campo_nivel = 'nivel_es'
      break;
      case 3:
        campo_nivel = 'nivel_en'
      break;
    }

    db.none("UPDATE public.lingua_usuarios SET "+campo_nivel+" = $1, date_last_mod = $3 WHERE id = $2", [nivel, id, new Date(), campo_nivel])
    .then(function () {
        console.log('nivel guardado usuario: '+id+" nivel: "+nivel);
    })
    .catch(function (error) {
        console.log("ERROR:", error);
    });
}


function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;

