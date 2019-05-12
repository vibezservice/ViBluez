var util = require('util');
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd=require('node-cmd');
var utils = require("../Utils/utils");
const CHUNK_REGEX = /\|(\d+)\/(\d+)\|/;
const CHUNK_PREFIX = 0;
const CHUNK_CURRENT = 1;
const CHUNK_TOTAL = 2;
var wifiInfoList = [];

var WifiCheckCharacteristic= function(){
    WifiCheckCharacteristic.super_.call(this, {
        uuid: 'efffe8eecb53454098240c841848f5be',
        properties: ['write']
    });

}  

function chunkString(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}
   
util.inherits(WifiCheckCharacteristic, Characteristic);

WifiCheckCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
    console.log("checking");
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
    try {
        var json = JSON.parse(str);

        var networkIdStr = Buffer.from(json.ssid,'utf8').toString('hex');
        const chunkedNetworkId = chunkString(networkIdStr, 2);
        var i;
        var networkId = "";
        for( i = 0; i < chunkedNetworkId.length; i++) {
                if (chunkedNetworkId[i] === "27"){
                        chunkedNetworkId[i] = "e28099";
                }
                networkId += chunkedNetworkId[i];
        }
        utils.listWpaSupplicantNetworks(function(error, info, networkList){
            if(error){
                var result = Characteristic.RESULT_UNLIKELY_ERROR;
                callback(result, "test");
            }else{
                var network = _.find(networkList, function(n){
                    var re = new RegExp('"', 'g');
                    return n.ssid.replace(re, '') == networkId;
                });
                console.log(networkId) ;
                console.log(network);
                if(network){
                    var result = Characteristic.RESULT_SUCCESS;
                    callback(result, "test");
                }else{
                    var result = Characteristic.RESULT_UNLIKELY_ERROR;
                    callback(result, "test");
                }
            }
        });
    }catch (error) {
        var result = Characteristic.RESULT_UNLIKELY_ERROR;
        callback(result);
    }
}

module.exports = WifiCheckCharacteristic;