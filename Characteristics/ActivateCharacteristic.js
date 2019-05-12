var util = require('util');
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd=require('node-cmd');
var utils = require("../Utils/utils");
var shell = require("shelljs");
var intervalId;
var ping = require ("net-ping");
var request = require('request');
var socketOp = require('../Utils/socket');

const CHUNK_REGEX = /\|(\d+)\/(\d+)\|/;
const CHUNK_PREFIX = 0;
const CHUNK_CURRENT = 1;
const CHUNK_TOTAL = 2;
var wifiInfoList = [];

var ActivateCharacteristic = function(){
    ActivateCharacteristic.super_.call(this, {
        uuid: 'bebb73fa10ae494dae2fb07e98295b3b',
        properties: ['write']
    });

}


util.inherits(ActivateCharacteristic, Characteristic);

ActivateCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
    var str = data.toString('utf8');
    var matches = str.match(CHUNK_REGEX);
    var goThrough = false;
    if(matches && matches.length > 0){
        var expectedParts = matches[CHUNK_TOTAL];
        var chunkInfo = matches[CHUNK_PREFIX];
        var incomingPart = parseInt(matches[CHUNK_CURRENT]);
        var content = str.replace(chunkInfo,"");

        wifiInfoList.push({ i : incomingPart, content : content });
        if (wifiInfoList.length == expectedParts){
            goThrough = true
            wifiInfoList = _.sortBy(wifiInfoList, 'i');
        }
    }else{
        var result = Characteristic.RESULT_SUCCESS;
        callback(result, "test");
    }
    if (!goThrough){
        var result = Characteristic.RESULT_SUCCESS;
        callback(result, "test");
        return
    }
    var str = ""
    for (i in wifiInfoList){
        var cont = wifiInfoList[i].content;
        str += cont;
    }
    wifiInfoList = [];
    var gearInfo = fs.readFileSync('/etc/gearc.cfg','utf8');
    var gearJson = JSON.parse(gearInfo);
    var json = JSON.parse(str);
    if(json.activationCode == gearJson.partNumber){
        request.post(
            utils.serviceEndpoint + "/api/gear/activate", {form: { uid: gearJson.uniqueId, customerId: json.customerId, activationCode: json.activationCode}},
            function(error, response, body){
                if(body && (response.statusCode == 200 || response.statusCode == 304)){
                    var parsed = JSON.parse(body)
                    if(parsed.isSuccess){
                        gearJson.activationDate = parsed.resultObject.activationDate;
                        gearJson.ownerId = parsed.resultObject.ownerId;
                        gearJson.activated = true;
                        var jsonString = JSON.stringify(gearJson);
                        fs.writeFileSync('/etc/gearc.cfg',jsonString);
                        socketOp.establish();
                        var result = Characteristic.RESULT_SUCCESS;
                        callback(result);
                    }else{
                        if (parsed.errorMessage){
                            const stack = {
                                t: 1,
                                m: parsed.errorMessage
                            };
                            utils.errorStack = stack;
                        }else{
                            const stack = {
                                t: 1,
                                m: "An error occured, please try again"
                            };
                            utils.errorStack = stack;
                        }
                        var result = Characteristic.RESULT_UNLIKELY_ERROR;
                        callback(result);
                    }
                }else{
                    const stack = {
                        t: 1,
                        m: "An error occured, please try again"
                    };
                    utils.errorStack = stack;
                    var result = Characteristic.RESULT_UNLIKELY_ERROR;
                    callback(result);
                }

            }
        );
    }else{
        const stack = {
            t: 1,
            m: "Wrong activation code"
        };
        utils.errorStack = stack;
        var result = Characteristic.RESULT_UNLIKELY_ERROR;
        callback(result, "test");
    }
},


module.exports = ActivateCharacteristic;
