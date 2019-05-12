var bleno = require('bleno');
var RadioStarterService = require('./Services/RadioStarterService.js');
var name = 'name';
var serviceUuids = ['fffffffffffffffffffffffffffffff0'];
var fs = require('fs');
var cmd=require('node-cmd');
var randomString = require("randomstring");
var piWifi = require('pi-wifi');
var primaryService = new RadioStarterService();
var utils = require("./Utils/utils");
var io = require('socket.io-client');
var network = require('network');
var io = require("socket.io-client");
var socketOp = require("./Utils/socket");
var execSync = require('child_process').execSync;
var exec = require('child_process').exec;
var _ = require("underscore");


var os = require('os');
var ifaces = os.networkInterfaces();
var uniqueId;

if (!fs.existsSync('/etc/gearc.cfg')){
  var cmd = "npm list -g | grep vibluez" 
  var stdout = execSync(cmd).toString();
  var version = _.last(stdout.split('@')).trim();
  console.log(version.toString()); 
  var json = {
    uniqueId : "EPIQURGear-" + randomString.generate(6).toUpperCase(),
    registered : false,
    registrationDate : null,
    mountId : null,
    activated : false,
    activationDate : null,
    ownerId : null,
    version : version
  }

  uniqueId = json.uniqueId;
  var registered = false;
  fs.writeFileSync('/etc/gearc.cfg',JSON.stringify(json));
}else{
  var jsonString = fs.readFileSync('/etc/gearc.cfg','utf8');
  var json = JSON.parse(jsonString);
  uniqueId = json.uniqueId;
}

socketOp.establish();
bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state);
  if (state === 'poweredOn') {
    console.log(primaryService.uuid);
    bleno.startAdvertising(uniqueId, [primaryService.uuid]);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on('advertisingStart', function(error) {
  console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

  if (!error) {
    bleno.setServices([primaryService], function(error){
      console.log('setServices: '  + (error ? 'error ' + error : 'success'));
    });
  }
});

bleno.on('accept', function(clientAddress) {
  console.log(clientAddress);
});

utils.broadcastingChecker();
//utils.fixTime();
utils.changeScreen(utils.OLED_DISPLAY_OPERATION.WELCOME);

setTimeout(function(){
  if(!utils.softwareUpdating){
    utils.changeScreen(utils.OLED_DISPLAY_OPERATION.INFO);  
  }
},5000);



// setInterval(function(){
//   utils.fixTime();
// }, 5 * 60 * 1000);
