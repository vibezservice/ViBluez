var fs = require("fs");
var _ = require("underscore");
var shell = require("shelljs");
var ps = require("ps-node");
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var ping = require("net-ping");
var request = require('request');
var pingPoint = "8.8.8.8"
var psTree = require('ps-tree');
var bleno = require('bleno');

var serviceEndpoint = "https://api.epiqur.tv"; 
var streamEndpoint = "rtmp://stream.epiqur.tv/vibez/";
var currentStreamPoint = undefined;
var connectingToWifi = false;
var connectingWifiName = "";
var keepBroadcasting = false;
var intervalId = undefined;
var lastConnectionStatus = undefined;
var connectionErrorIterationCount = 0;
var errorStack = null;
var checkingStreamStatus = false;
var oledOperationPid = null;
var softwareUpdating = false;
var currentConnectionStatus = false;

const OLED_DISPLAY_OPERATION = Object.freeze({ "WELCOME": "welcome.py", "INFO": "sys_info.py", "BROADCASTING": "pi_logo.py", "UPDATING": "tv_snow.py" });

function listWpaSupplicantNetworks(cb) {
    fs.readFile('/etc/wpa_supplicant/wpa_supplicant.conf', 'utf8', function (err, data) {
        if (err) {
            cb(err);
        } else {
            var passages = data.split('network');
            var interfaceInformation = passages[0];
            var networkArray = [];
            var re = new RegExp('"', 'g');
            for (var i = 1; i < passages.length; i++) {
                var networkString = passages[i].trim();
                var trimmedNetworkString = networkString.replace('={', '').replace('}', '').trim();
                var propertyArray = trimmedNetworkString.split('\n');
                var networkObj = {};
                for (var j = 0; j < propertyArray.length; j++) {
                    var prop = propertyArray[j].trim();
                    prop.replace(re, '');
                    var pArray = prop.split('=');
                    networkObj[pArray[0]] = pArray[1];
                }
                networkArray.push(networkObj);
            }
            cb(null, interfaceInformation, networkArray);
        }
    });
}


function getActiveWpaSupplicantNetwork(cb) {

    shell.exec("iwconfig | grep wlan0", function (code, stdout, stderr) {
        if (stdout) {
            var array = stdout.trim().split("ESSID:");
            if (array.length == 2) {
                var re = new RegExp('"', 'g');
                var a = array[1].replace(re, '');
                cb(null, a);
            } else {
                cb(null, null);
            }

        }
    });
}

function getNetworkObjectFromString(str) {
    var re = new RegExp('"', 'g');
    var networkString = str.trim();
    var trimmedNetworkString = networkString.replace('={', '').replace('}', '').trim();
    var propertyArray = trimmedNetworkString.split('\n');
    var networkObj = {};
    for (var j = 0; j < propertyArray.length; j++) {
        var prop = propertyArray[j].trim();
        prop.replace(re, '');
        if (!prop.startsWith("#")) {
            var pArray = prop.split('=');
                
            networkObj[pArray[0]] = pArray[1];
        }
    }
    console.log(networkObj);
    return networkObj;
}

function writeNetworksToWpaSupplicantFile(interfaceInfo, networkArray, cb) {
    var strArray = [interfaceInfo.trim()];

    for (var i = 0; i < networkArray.length; i++) {
        var network = networkArray[i];
        var str = 'network={\n';
        for (var o in network) {
            str += '\t' + o + '=' + network[o] + '\n';
        }
        str += '}\n';
        strArray.push(str);
    }
    var newStr = (strArray).join('\n');
    fs.writeFile('/etc/wpa_supplicant/wpa_supplicant.conf', newStr, function (err, data) {
        if (err) {
            cb(err);
        } else {
            cb(null, data);
        }
    })
}

function listAutoJoinItems() {
    var autoJoinInfo = fs.readFileSync('/etc/autojoin.conf', 'utf8');
    var jsonArray = JSON.parse(gearInfo);
    return jsonArray;
}

function getAutoJoinItem(ssid, cb) {
    var autoJoinInfo = fs.readFileSync('/etc/autojoin.conf', 'utf8');
    var jsonArray = JSON.parse(autoJoinInfo);
    var autoJoinItem = _.find(jsonArray, function (ac) {
        return ac.ssid == ssid
    })

    if (!autoJoinItem) {
        return null;
    } else {
        return autoJoinItem;
    }

}

function setAutoJoinItem(ssid, autoJoin) {
    var autoJoinInfo = fs.readFileSync('/etc/autojoin.conf', 'utf8');
    var jsonArray = JSON.parse(autoJoinInfo);
    var autoJoinItem = _.find(jsonArray, function (ac) {
        return ac.ssid == ssid
    })
    if (autoJoinItem) {
        autoJoinItem.autoJoin = autoJoin;
    } else {
        var json = {
            ssid: ssid,
            autoJoin: autoJoin
        };
        jsonArray.push(json);
    }
    var jsonString = JSON.stringify(jsonArray);
    fs.writeFileSync('/etc/autojoin.conf', jsonString);
    return true;
}

function removeAutoJoinItem(ssid) {
    var autoJoinInfo = fs.readFileSync('/etc/autojoin.conf', 'utf8');

    var jsonArray = JSON.parse(autoJoinInfo);
    console.log(jsonArray[0]);
    var index = _.findIndex(jsonArray, function (ac) {
        return ac.ssid == ssid
    })
    console.log("AAAAAAAAT" + index)
    if (index != -1) {

        jsonArray = jsonArray.splice(index, 1);
        console.log(jsonArray);
    }
    if (jsonArray.length == 0) {
        var jsonString = "[]"
        fs.writeFileSync('/etc/autojoin.conf', jsonString);
    } else {
        var jsonString = JSON.stringify(jsonArray);
        fs.writeFileSync('/etc/autojoin.conf', jsonString);
    }

    return true;
}

function broadcastingChecker() {
    var _this = this;
    intervalId = setInterval(function () {
        console.log(_this.currentStreamPoint);
        if (_this.currentStreamPoint && !_this.checkingStreamStatus) {
            _this.checkingStreamStatus = true
            ps.lookup({
                command: 'avconv',
                psargs: 'lx'
            }, function (err, resultList) {
                if ((resultList && resultList.length == 0) || (!resultList)) {
                    _this.changeScreen(OLED_DISPLAY_OPERATION.INFO);
                    var streamPoint = _this.currentStreamPoint;
                    _this.currentStreamPoint = undefined;
                    var session = ping.createSession();
                    session.pingHost(pingPoint, function (error, target) {
                        if (!error) {
                            setTimeout(function () {
                                request.get(_this.serviceEndpoint + "/api/stream/checkIfStreamIsStopped/" + streamPoint, function (error, response, body) {
                                    if (body && (response.statusCode == 200 || response.statusCode == 304)) {
                                        var parsed = JSON.parse(body);

                                        if (parsed.isSuccess) {
                                            const hasBeenFinished = parsed.resultObject;
                                            if (!hasBeenFinished) {
                                                var cmd = 'sudo avconv -f alsa -ac 2 -ar 44100 -thread_queue_size 4096 -i hw:1,0 -acodec aac -ab 192k -f flv ' + _this.streamEndpoint + streamPoint + '_audio';
                                                exec(cmd, { maxBuffer: 1024 * 1024 * 500 }, function (error, stdout, stderr) {
                                                    console.log(stdout);
                                                });
                                                _this.currentStreamPoint = streamPoint;
                                            }
                                        }
                                    }
                                    _this.checkingStreamStatus = false;
                                })
                            }, 2000);
                        } else {
                            _this.checkingStreamStatus = false;
                        }
                    })
                } else if (resultList && resultList.length > 0) {
                    var session = ping.createSession();
                    session.pingHost(pingPoint, function (error, target) {
                        if (error) {
                            connectionErrorIterationCount += 1;
                            if (connectionErrorIterationCount >= 5) {
                                for (var i = 0; i < resultList.length; i++) {
                                    var p = resultList[i];
                                    ps.kill(p.pid, function (err) { });
                                }
                                _this.changeScreen(OLED_DISPLAY_OPERATION.INFO);
                            }
                            _this.checkingStreamStatus = false;
                        } else {
                            connectionErrorIterationCount = 0;
                            _this.checkingStreamStatus = false;
                        }
                    });
                }
            });
        }

    }, 4000);
}

function fixTime() {
    console.log('fixing time ');
    var cmd = 'sudo /etc/init.d/ntp stop && sudo ntpd -q -g && sudo /etc/init.d/ntp start';
    var child = exec(cmd, { timeout : 250000 });
    child.stdout.on('data', function (data) {
        console.log(data);
    })
    child.on('close', function (code) {
        console.log("Close code: " + code);
    })

    setTimeout(function () {
        kill(child.pid);
    }, 25000);

    // exec(cmd, {maxBuffer: 1024 * 1024 * 500},function(error, stdout, stderr){ 
    //     console.log("==========ERROR==========");
    //     console.log(error);
    //     console.log("==========ERROR==========");
    //     console.log("\n\m");
    //     console.log("==========STDOUT==========");
    //     console.log(stdout);
    //     console.log("==========STDOUT==========");
    //     console.log("\n\n");
    //     console.log("==========STDERR==========");
    //     console.log(stderr);
    //     console.log("==========STDERR==========");
    // });
}

function changeScreen(displayOperation) {
    console.log("CHANGE SCREEEN")
    if (displayOperation) {
        if (oledOperationPid) {
            kill(oledOperationPid);
        }
        const child = exec("python3 /home/pi/luma.examples/examples/" + displayOperation + " -i spi");
        oledOperationPid = child.pid;
    } else {

    }
}

function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function kill(pid, signal, callback) {
    signal = signal || 'SIGKILL';
    callback = callback || function () { };
    var killTree = true;
    if (killTree) {
        psTree(pid, function (err, children) {
            [pid].concat(
                children.map(function (p) {
                    return p.PID;
                })
            ).forEach(function (tpid) {
                try { process.kill(tpid, signal) }
                catch (ex) { }
            });
            callback();
        });
    } else {
        try { process.kill(pid, signal) }
        catch (ex) { }
        callback();
    }
};

module.exports = {
    "listWpaSupplicantNetworks": listWpaSupplicantNetworks,
    "getNetworkObjectFromString": getNetworkObjectFromString,
    "writeNetworksToWpaSupplicantFile": writeNetworksToWpaSupplicantFile,
    "getActiveWpaSupplicantNetwork": getActiveWpaSupplicantNetwork,
    "connectingToWifi": connectingToWifi,
    "connectingWifiName": connectingWifiName,
    "setAutoJoinItem": setAutoJoinItem,
    "getAutoJoinItem": getAutoJoinItem,
    "listAutoJoinItems": listAutoJoinItems,
    "removeAutoJoinItem": removeAutoJoinItem,
    "keepBroadcasting": keepBroadcasting,
    "broadcastingChecker": broadcastingChecker,
    "hex2a": hex2a,
    "errorStack": errorStack,
    "serviceEndpoint": serviceEndpoint,
    "streamEndpoint": streamEndpoint,
    "pingPoint": pingPoint,
    "currentStreamPoint": currentStreamPoint,
    "fixTime": fixTime,
    "kill": kill,
    "OLED_DISPLAY_OPERATION": OLED_DISPLAY_OPERATION,
    "changeScreen": changeScreen,
    "softwareUpdating": softwareUpdating,
    "currentConnectionStatus" : currentConnectionStatus
};
