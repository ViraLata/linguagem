/*
Navicat PGSQL Data Transfer

Source Server         : remote postgresql_copy
Source Server Version : 90409
Source Host           : remote
Source Database       : remotedatabase
Source Schema         : public

Target Server Type    : PGSQL
Target Server Version : 90409
File Encoding         : 65001

Date: 2016-10-15 08:49:50
*/


-- ----------------------------
-- Table structure for lingua_usuarios
-- ----------------------------
DROP TABLE IF EXISTS "public"."lingua_usuarios";
CREATE TABLE "public"."lingua_usuarios" (
"idfb" int8,
"email" char(150) COLLATE "default",
"nivel" int4 DEFAULT 1,
"fase" int4 DEFAULT 0,
"lang" int2 DEFAULT 1 NOT NULL,
"date_added" timestamptz(6),
"date_last_mod" timestamptz(6),
"ok" int4,
"ko" int4,
"id_last_mo" int8,
"puntos" int8 DEFAULT 0,
"id" int4 DEFAULT nextval('lingua_usuarios_id_seq'::regclass) NOT NULL,
"nivel_es" int4 DEFAULT 1,
"nivel_en" int4 DEFAULT 1,
"nivel_pt" int4 DEFAULT 1
)
WITH (OIDS=FALSE)

;

-- ----------------------------
-- Alter Sequences Owned By 
-- ----------------------------
