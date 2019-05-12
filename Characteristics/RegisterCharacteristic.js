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

const CHUNK_REGEX = /\|(\d+)\/(\d+)\|/;
const CHUNK_PREFIX = 0;
const CHUNK_CURRENT = 1;
const CHUNK_TOTAL = 2;
var wifiInfoList = [];

var RegisterCharacteristic = function(){
    RegisterCharacteristic.super_.call(this, {
        uuid: '751f6974db9446feab5d04f8636bbc60',
        properties: ['write']
    });

}


util.inherits(RegisterCharacteristic, Characteristic);

RegisterCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
   console.log("REGISTER"); 
   var gearInfo = fs.readFileSync('/etc/gearc.cfg','utf8');
   var json = JSON.parse(gearInfo);
   var version = json.version;
   var deviceId = json.uniqueId;
   if (json.registered != null && json.registered === true){
        var result = Characteristic.RESULT_SUCCESS;
        callback(result);
    }else{
        request.post(
            utils.serviceEndpoint + "/api/gear/register", {form: { uid : deviceId, version: version }},
            function(error, response, body){
                console.log(error);
                if(body && (response.statusCode == 200 || response.statusCode == 304)){
                    var parsed = JSON.parse(body);
                    if(parsed.isSuccess){
                        json.registered = true;
                        json.registrationDate = parsed.resultObject.VGEAR.lastUpdateTime
                        json.partNumber = parsed.resultObject.VGEAR.partNumber;
                        json.mountId = parsed.resultObject.VGEAR.mountId;
                        var jsonString = JSON.stringify(json);
                        fs.writeFileSync('/etc/gearc.cfg',jsonString);

                        var result = Characteristic.RESULT_SUCCESS;
                        callback(result);
                    }else{
                       if (parsed.errorMessage){
                            const stack = {
                                t: 0,
                                m: parsed.errorMessage
                            };
                            utils.errorStack = stack;
                        }else{
                            const stack = {
                                t: 0,
                                m: "An error occured, please try again"
                            };
                            utils.errorStack = stack;
                        }
                        var result = Characteristic.RESULT_UNLIKELY_ERROR;
                        callback(result);
                    }
                }else{
                    const stack = {
                        t: 0,
                        m: "An error occured, please try again"
                    };
                    utils.errorStack = stack;
                    var result = Characteristic.RESULT_UNLIKELY_ERROR;
                    callback(result);
                }

            }
        );
    }
     
},


module.exports = RegisterCharacteristic;
