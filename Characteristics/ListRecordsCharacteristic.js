var util = require('util');
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var utils = require("../Utils/utils");
var OLED_DISPLAY_OPERATION = utils.OLED_DISPLAY_OPERATION;
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

var ListRecordsCharacteristic= function(){
    ListRecordsCharacteristic.super_.call(this, {
        uuid: 'cb0d0aa5efef445e970ebd78c67a383f',
        properties: ['write']
    });

}
function chunkString(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

util.inherits(ListRecordsCharacteristic, Characteristic);

ListRecordsCharacteristic.prototype.onSubscribe = function(maxSize, updateValueCallback)
{
    console.log("subscribed");
    const path = "/home/pi/records";
    fs.readdir(path, function(err, items) { 
        if (!err) {
            var list = [];
            async.each(items, function(item, cb) { 
                var file = path + '/' + item;
            
                fs.stat(file, function(err, stats) {
                    list.push({
                        "file" : file,
                        "size" : stats["size"];
                    })
                    cb();
                });
            }, function(err){ 
                if(!err){
                    var stringified = JSON.stringify(list);
                    console.log(stringified);
                    var chunks = chunkString(stringified, 50);

                    for (i in chunks){
                        sleep.msleep(30);
                        var dataToSend = "|" + (parseInt(i) + 1) + "/" + chunks.length + "|"  + chunks[i];

                        var buffer = Buffer.from(dataToSend, 'utf8');
                        updateValueCallback(buffer)
                    }
                }
            });
           
        }
    });
    checkWifi(updateValueCallback);
}

ListRecordsCharacteristic.prototype.onUnsubscribe = function(maxSize, updateValueCallback)
{
    console.log('unsubscribe');
    if (intervalId){
        clearInterval(intervalId);
        intervalId = null;
    }

}


module.exports = ListRecordsCharacteristic;