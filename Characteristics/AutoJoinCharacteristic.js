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

const CHUNK_REGEX = /\|(\d+)\/(\d+)\|/;
const CHUNK_PREFIX = 0;
const CHUNK_CURRENT = 1;
const CHUNK_TOTAL = 2;
var wifiInfoList = [];

var AutoJoinCharacteristic = function(){
    AutoJoinCharacteristic.super_.call(this, {
        uuid: '7ef2a641f34f499a87c705ba035ac60a',
        properties: ['write']
    });

}


util.inherits(AutoJoinCharacteristic, Characteristic);

AutoJoinCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
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
        callback(Characteristic.RESULT_SUCCESS);
        return;
    }
    if (!goThrough){
        var result = Characteristic.RESULT_SUCCESS;
        callback(result);
        return
    }
    var str = ""
    for (i in wifiInfoList){
        var cont = wifiInfoList[i].content;
        str += cont;
    }
    wifiInfoList = [];
    var json = JSON.parse(str);
    var result = utils.setAutoJoinItem(json.ssid, json.on);
    if(result){
    	var result = Characteristic.RESULT_SUCCESS;
		callback(result);
    }else{
    	var result = Characteristic.RESULT_UNLIKELY_ERROR;
		callback(result);
    }
}

module.exports = AutoJoinCharacteristic;