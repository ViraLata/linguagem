var express = require('express')
//var bodyParser = require('body-parser')
var JSONbig = require('json-bigint');
var request = require('request')
var config  = require('./config.json');
var lang  = require('./lang.json');
var query = require('pg-query');
//var heads = require('heads.js');
var Promise = require("bluebird");
var pgp = require('pg-promise')();
var conflang = 'pt'
var app = express()
var token = "THE_TOKEN_FROM_FACEBOOK"

app.set('port', (process.env.PORT || 80))

//inicio de la bd
var heads_ok_pt = [':) Continue assim!', ':) E isso ai!', ':) Certa resposta!', ':) Correto!', ':) Golaço!', ':) Que esperto!', ':) Que inteligente!', ':)  Mais uma certa!', ':) Arrasou!', ':) Beleza!']; 
var heads_ko_pt = [':( Acredite em você!', ':( Tente outra vez!', ':( Persista!', ':( Confio em você!', ':( Não desanime!', ':( Foco!', ':( Fala serio!', ':( Foco, força e fe!', 'Você consegue!', 'Animo!']; 

var heads_ok_es = [':) Continua así!', ':) Perfecto!', ':) Muy bien!', ':) Correcto!', ':) Golazo!', ':) Que experto!', ':) Que inteligente', ':) Una más correcta!', ':) Vas bien!', ':) mejor imposible!', ':) Súper bien!', ':) Genial!'];

var heads_ko_es = [':( Intenta con esta!', ':( Le pasa a cualquiera!', ':( Vamos! Vos podes!', ':( Venias re bien!', ':( No te desanimes!', ':( Vamos de nuevo!', ':( Esta es fácil!', ':( Retroceder nunca, rendirse jamás!', ':( Casi!', ':( Animo!']; 


var promise = require('bluebird'); // or any other Promise/A+ compatible library;
var options = {
    promiseLib: promise // overriding the default (ES6 Promise);
};
var pgp = require('pg-promise')(options);
// See also: https://github.com/vitaly-t/pg-promise#initialization-options




var cn = {
    host: 'localhost', // 'localhost' is the default;
    port: 5432, // 5432 is the default;	
    sslmode: 'require',
    database: 'database',
    user: 'usuario',
    password: 'password'
}; 


var db = pgp(cn); // database instance;	



console.log('inicio')


app.use(function (req, res, next) {
  if (req.method == 'POST') {
    var body = '';
    req.on('data', function (data) {
      body += data;
    });
    console.log(body)
    req.on('end', function () {
      req.body = JSONbig.parse(body);
      next();
    });
  } else {
  	next();
  }
}); 

// index
app.get('/', function (req, res) {
	res.send('hola mundo ;)')
})

// for facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === '3432454564343565433232098765432') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})


// to post data
app.post('/webhook/', function (req, res) {
	messaging_events = req.body.entry[0].messaging
	for (i = 0; i < messaging_events.length; i++) {
		event = req.body.entry[0].messaging[i]
		sender = String(event.sender.id)
		console.log(new Date())
		getInsertUserFbid(sender)
    		.then(function (userId) {
    			//tenemos id con que trabajar :D
    		    console.log('tenemos id '+userId.lang)
    		    if(userId.lang == 0 || userId.lang === undefined ) {
    		    	//console.log('sin idioma')
    		    	//console.log('El usuario no tiene idioma, requiere ingresarlo')
    		    	//ahora se tiene que pedir el nivel
					if (event.message && event.message.text) {
						//console.log('mandamos la selección del idioma')
						text = event.message.text
						//enviamos la pregunta del idioma
						sendLang(sender)
					}
					if (event.postback) {
						text = JSON.stringify(event.postback)
						//console.log(text)
						if (text.substring(0, 200) == '{"payload":"pt"}') {
							//sendTextMessage(sender, "Portugues", token)
							InsertLangbyid(userId.id, 1) // Guardamos en la tabla el idioma
							sendPregunta(sender, lang.pt.msg_lang_modified, 'pt')
							console.log('pt')
						}
						if (text.substring(0, 200) == '{"payload":"es"}') {
							//sendTextMessage(sender, "Es", token)
							InsertLangbyid(userId.id, 2) // Guardamos en la tabla el idioma
							sendPregunta(sender, lang.es.msg_lang_modified, 'es')
							console.log('es')
						} else {
							console.log('ningun postback conocido')
							sendLang(sender)
						}
						
					}

    		    } else {
    		    	//elegimos el idioma que sera usado
    		    	switch (userId.lang) {
    		    		case 1:
    		    		idioma = lang.pt
    		    		conflang = 'pt'
    		    		head_ok = heads_ok_pt[Math.floor(Math.random()*heads_ok_pt.length)]
    		    		head_ko = heads_ko_pt[Math.floor(Math.random()*heads_ok_pt.length)]
    		    		break;
    		    		case 2:
    		    		idioma = lang.es
    		    		conflang = 'es'
    		    		head_ok = heads_ok_es[Math.floor(Math.random()*heads_ok_pt.length)]
    		    		head_ko = heads_ko_es[Math.floor(Math.random()*heads_ok_pt.length)]
    		    		break;
    		    	}
    		    	if (event.message && event.message.text) {
						text = event.message.text
						//text = text.toLowerCase()
						//primera acción
						//comando = text.replace(/(([^\s]+\s\s*){1})(.*)/,"$1…")
						//console.log(comando)
						comando = FormatMO(text);
						//console.log(comando)


						if (comando == 'ayuda') {
							sendHelp(sender)
						} else if (comando == 'idioma') {
							sendLang(sender)
						} else {
							sendPregunta(sender, idioma.msg_head, conflang)
						}
					}
					if (event.postback) {
						text = JSON.stringify(event.postback)
						//console.log(text)
						//seleccionamos el id del postback
						idpostback = text.substring(text.lastIndexOf("$")+1,text.lastIndexOf("_"))
						//res = idpostback.split("_");
						console.log('id postback = '+idpostback+' y el last_mo es ='+userId.id_last_mo)
						if (idpostback == userId.id_last_mo) {
							//el ultimo postback corresponde al ultimo enviado
							//Guardamos el valor del postback sin el id
							respuesta_call = text.substring(text.lastIndexOf("_")+1,text.lastIndexOf("%"))
							console.log("y la respuesta es ="+respuesta_call)
							if (respuesta_call == 'ok') {
								console.log('ok')
								//agregamos los puntos al usuario
								addPointbyid(sender)
								//mandamos el MT de info de los puntos
								//sendInfo(sender, userId.puntos)
								msg_pregunta = ' '+idioma.msg_points+' '+userId.puntos
								sendPregunta(sender, head_ok+msg_pregunta, conflang)
							} else if (respuesta_call == 'ko') {
								console.log('ko')
								sendPregunta(sender, head_ko, conflang) 
							}
						} else {
							//la persona intenta responder una pregunta anterior
							res_comando = text.substring(text.lastIndexOf("_")+1,text.lastIndexOf("%"))
							console.log('la persona intenta responder una pregunta anterior '+text)
							if (res_comando == 'ok') {
								console.log('ok_ilegal')
								sendPregunta(sender, idioma.cheating_ok, conflang)
							} else if (res_comando == 'ko') {
								console.log('ko_ilegal')
								sendPregunta(sender, idioma.cheating_ko, conflang) 
							} else if (text.substring(0, 200) == '{"payload":"help"}') {
								sendHelp(sender)
								//console.log('help')
							} else if (text.substring(0, 200) == '{"payload":"pt"}') {
								InsertLangbyid(userId.id, 1)
								sendPregunta(sender, idioma.msg_lang_modified, conflang)
							} else if (text.substring(0, 200) == '{"payload":"es"}') {
								InsertLangbyid(userId.id, 2)
								sendPregunta(sender, idioma.msg_lang_modified, conflang)
							} else if (text.substring(0, 200) == '{"payload":"idioma"}') {
								sendLang(sender)
							} else if (text.substring(0, 200) == '{"payload":"quiz"}') {
								sendPregunta(sender, idioma.msg_head, conflang)
							} else {
							sendPregunta(sender, idioma.msg_dont_understand, conflang)
							//sendTextMessage(sender, "No entendi tu mensaje", token)
						}
						}


						
					}

    		    }


    		})
    		.catch(function (error) {
    		    // something went wrong;
    		});

	}
	res.sendStatus(200)
})


function sendTextMessage(sender, text) {
	messageData = {
		text:text
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendInfo(sender, puntos) {

	mensaje = idioma.msg_points+' '+puntos
	messageData = {
		text:mensaje
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function doSubscribeRequest() {
    request({
            method: 'POST',
            uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + token
        },
        function (error, response, body) {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}


function sendNivel(sender) {
	messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "button",
				text: "Escoge tu nivel de ingles?",
				"buttons": [
					{
						type: "postback",
						"title": "Basico",
						"payload": "Basico"
					},
					{
						type: "postback",
						"title": "Intermediario",
						"payload": "Intermediario"
					},
					{
						type: "postback",
						"title": "Avanzado",
						"payload": "Avanzado"
					}
				]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending nivel: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendLang(sender) {
	messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "button",
				text: lang.pt.welcome_message,
				"buttons": [
					{
						type: "postback",
						"title": lang.pt.btn_pt,
						"payload": "pt"
					},
					{
						type: "postback",
						"title": lang.pt.btn_es,
						"payload": "es"
					}
				]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending lang: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}
 
function sendHelp(sender) {
	messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "button",
				text: idioma.msg_help,
				"buttons": [
					{
						type: "postback",
						"title": idioma.btn_idioma,
						"payload": "idioma"
					},
					{
						type: "web_url",
						"title": idioma.btn_linguagem,
						"url" : "http://linguagem.co"
					},
					{
						type: "postback",
						"title": idioma.btn_quiz,
						"payload": "quiz"
					}
				]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending nivel: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendPregunta(sender, cabeza, idioma) {
	table = "lingua_words_pt"
	id_random = Math.floor(Math.random()*100000)
	//escogemos el nombre de la tabla, segun el idioma
	if (idioma == 'pt') {
		table = "lingua_words_pt"
		footmsg = lang.pt.msg_foot
	} else if (idioma == 'es') {
		table = "lingua_words_es"
		footmsg = lang.es.msg_foot
	} else {
		table = "lingua_words_pt"
		footmsg = lang.pt.msg_foot
	}
	

	db.one("SELECT ingles, word, (SELECT ingles from public."+table+" ORDER BY RANDOM() limit 1) as mala, id FROM public."+table+" ORDER BY RANDOM() limit 1", true)
    .then(function (data) {
    console.log("enviamos una pregunta")
    InsertidLastMT(sender, id_random)
    console.log(id_random)
    //un simple carisellazo (toss a coin)
    switch (Math.round(Math.random())) {
    	case 0:
    	//pregunta = cabeza+", "+data.pt+" en ingles es ?"
    	pregunta = cabeza+", "+footmsg+" '"+data.word+"' ?"
    	respuesta_1 = data.ingles
    	respuesta_2 = data.mala
    	payload_1 = '$'+id_random+"_ok%"
    	payload_2 = '$'+id_random+"_ko%"
    	break;
    	case 1:
    	pregunta = cabeza+", "+footmsg+" '"+data.word+"' ?" 
    	respuesta_1 = data.mala
    	respuesta_2 = data.ingles
    	payload_1 = '$'+id_random+"_ko%"
    	payload_2 = '$'+id_random+"_ok%"
    	break;
    }
     messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "button",
				text: pregunta,
				"buttons": [
					{
						type: "postback",
						"title": respuesta_1,
						"payload": payload_1
					},
					{
						type: "postback",
						"title": respuesta_2,
						"payload": payload_2
					},
					{
						type: "postback",
						"title": "Ayuda",
						"payload": "help"
					}
				]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending question: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})   // success;
    }) //fin del select
    .catch(function (error) {
        console.log('Error: ', error)
    });

	
}

function getInsertUserFbid(idfb) {
    return db.task(function (t) {
            return t.oneOrNone('SELECT id, idfb, nivel, lang, id_last_mo, puntos FROM public.lingua_usuarios WHERE idfb = $1', idfb)
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


function InsertNivelbyid(id,nivel) {
    db.none("UPDATE public.lingua_usuarios SET nivel = $1, date_last_mod = $3 WHERE id = $2", [nivel, id, new Date()])
    .then(function () {
        console.log('nivel guardado');
    })
    .catch(function (error) {
        console.log("ERROR:", error);
    });
}

function InsertLangbyid(id,nivel) {
    db.none("UPDATE public.lingua_usuarios SET lang = $1, date_last_mod = $3 WHERE id = $2", [nivel, id, new Date()])
    .then(function () {
        console.log('Lang guardado');
    })
    .catch(function (error) {
        console.log("ERROR:", error);
    });
}

function InsertidLastMT(sender,idmt) {
    db.none("UPDATE public.lingua_usuarios SET id_last_mo = $1, date_last_mod = $3 WHERE idfb = $2", [idmt, sender, new Date()])
    .then(function () {
        console.log('Ultimo MT guardado');
    })
    .catch(function (error) {
        console.log("ERROR:", error);
    });
}

function addPointbyid(sender) {
    db.none("UPDATE public.lingua_usuarios SET puntos = puntos + 1, date_last_mod = $2 WHERE idfb = $1", [sender, new Date()])
    .then(function () {
        console.log('Punto guardado');
    })
    .catch(function (error) {
        console.log("ERROR:", error);
    });
}

function FormatMO (textomo) {
	textomo = textomo.toLowerCase() //convert to lowercase
	if (textomo.indexOf(' ') > -1) { // Check if there is more than one word.
      return textomo.substring(0, textomo.indexOf(' ')); // Extract first word.
    } else {
      return textomo; // Text is the first word itself.
    }
	//console.log('var num:'+textomo);
	return textomo
}


// spin spin sugar
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})