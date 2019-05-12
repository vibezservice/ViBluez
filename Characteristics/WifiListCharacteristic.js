var sleep = require('sleep');
var util = require('util');
var bleno = require('bleno');
var piWifi = require('pi-wifi');
var _ = require('underscore');
var Characteristic = bleno.Characteristic;
var utils = require("../Utils/utils");
var intervalId;
var list = {
	"a1" : 5,
	"a2" : 8,
	"a3" : [4,5,6,7,8]
}

var WifiListCharacteristic= function(){
    WifiListCharacteristic.super_.call(this, {
		uuid: '6674cb1ee11111e780c19a214cf093ae',
		properties: ['read', 'notify'],
		//value: new Buffer(strList)
	});

}

util.inherits(WifiListCharacteristic, Characteristic);

function chunkString(str, length) {
	return str.match(new RegExp('.{1,' + length + '}', 'g'));
}
function checkWifi(updateValueCallback){
		console.log('t');
		piWifi.scan(function(err, networks) {
			if (err) {
				return console.error(err.message);
			}
			console.log(networks);
			var groupedList = _.groupBy(networks, function(n){
				if(n.ssid) {
                    console.log(n.ssid);
                    var a = n.ssid;
                    return a
                }else{
                    return n.ssid;
				}

			});
            utils.listWpaSupplicantNetworks(function(err, info, networkList){
                var list = [];
                for (var key in groupedList){

                    if (groupedList.hasOwnProperty(key)){

                        var array = groupedList[key];

                        var highestSignalLevel = _.sortBy(_.filter(array, function(n){ return  n.ssid != null && n.ssid != undefined }), function(n){
                            return n.signalLevel;
                        }).reverse()[0];
                        if(!highestSignalLevel){
                            continue;
                        }
                        console.log(highestSignalLevel.ssid);
                        if(!err && networkList.length > 0){
                            console.log(networkList);
                            var network = _.find(networkList, function(n){
                                var re = new RegExp('"', 'g');
                                return n.ssid == Buffer.from(highestSignalLevel.ssid,'utf8').toString('hex');
                            });
                            if(network){
                            	console.log("known");
                                highestSignalLevel.k = true;
							}else{
                                highestSignalLevel.k = false;
							}
                        }
                        if (highestSignalLevel.signalLevel >= -50){
                            highestSignalLevel.lvl = "H"
                        } else if (highestSignalLevel.signalLevel < -50 && highestSignalLevel.signalLevel >= -60){
                            highestSignalLevel.lvl = "G"
                        } else if (highestSignalLevel.signalLevel < -60 && highestSignalLevel.signalLevel >= -70){
                            highestSignalLevel.lvl = "M"
                        } else {
                            highestSignalLevel.lvl = "L"
                        }
                        if (!highestSignalLevel.ssid){
                            highestSignalLevel.ssid = "";
                        }else{
                            highestSignalLevel.ssid = highestSignalLevel.ssid.replace("\\xe2\\x80\\x99","'");
                        }
                        if (highestSignalLevel.flags && (highestSignalLevel.flags.indexOf("WPA2-PSK-CCMP") != -1 || highestSignalLevel.flags.indexOf("WPS") != -1)){
                            highestSignalLevel.s = 1;
                        }else{
                            highestSignalLevel.s = 0;
                        }

                        var autoJoinItem = utils.getAutoJoinItem(highestSignalLevel.ssid);
                        if(autoJoinItem){
                            console.log(autoJoinItem);
                            highestSignalLevel.a = autoJoinItem.autoJoin == 1 ? true : false;
                        }




                        delete highestSignalLevel.signalLevel;
                        delete highestSignalLevel.flags;
                        delete highestSignalLevel.bssid;
                        delete highestSignalLevel.frequency;

                        list.push(highestSignalLevel);
                    }
                }
                var nw = _.filter(list, function(d){
                    return d.ssid != null && d.flags != null;
                })
                var str = JSON.stringify(list);
                var array = chunkString(str,50);

                //updateValueCallback(Buffer.from(""String(array.length), "utf8"));

                for (i in array){
                    sleep.msleep(30);
                    var dataToSend = "|" + (parseInt(i) + 1) + "/" + array.length + "|"  + array[i];
                    console.log(dataToSend);
                    var buffer = Buffer.from(dataToSend, 'utf8');
                    updateValueCallback(buffer)
                }
            })

		});
}

WifiListCharacteristic.prototype.onSubscribe = function(maxSize, updateValueCallback)
{
	console.log("subscribed")
	checkWifi(updateValueCallback);
}

WifiListCharacteristic.prototype.onUnsubscribe = function(maxSize, updateValueCallback)
{
	console.log('unsubscribe');
	if (intervalId){
		clearInterval(intervalId);
		intervalId = null;
	}

}
module.exports = WifiListCharacteristic;
