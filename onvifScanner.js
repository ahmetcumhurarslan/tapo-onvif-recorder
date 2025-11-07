#!/usr/bin/env node

const Onvif = require('node-onvif');
const config = require('./config');

const username = config.onvif.username || null;
const password = config.onvif.password || null;
const timeout = config.onvif.timeout || 5000;

async function listDevices() {
  console.log(`Probing ONVIF devices (timeout ${timeout} ms)...`);
  try {
    const deviceList = await Onvif.startProbe();

    if (!deviceList || deviceList.length === 0) {
      console.log('No ONVIF devices found');
      return [];
    }

    var finalDeviceList = [];

    for(var i=0;i<deviceList.length;i++){
        var obj = {};

        var info = deviceList[i];
        //console.log("info:",info);  
        var address = info.xaddrs[0].split("http://")[1].split("/")[0];
        obj.hostname = address.split(":")[0];
        obj.port = address.split(":")[1];
        obj.urn = info.urn;
        obj.hardware = info.hardware;
        
        const device = new Onvif.OnvifDevice({ xaddr:info.xaddrs[0], user: username, pass: password });
        await device.init({ timeout });
        const deviceInfo = await device.getInformation();
        //console.log('deviceInfo:', deviceInfo);
        obj.serialNumber = deviceInfo.SerialNumber;

        const profiles = await device.getProfileList();
        //console.log('profiles:', JSON.stringify(profiles,null,4));
        obj.streams = [];
        for(var j=0;j<profiles.length;j++){
            var profile = profiles[j];
            var streamObj = {
                width: profile.video.encoder.resolution.width,
                height: profile.video.encoder.resolution.height,
                url: "rtsp://" + username + ":" + password + "@" + profile.stream.rtsp.split("rtsp://")[1]
            }
            obj.streams.push(streamObj);
        }

        obj.streams.sort((a,b) => (b.width*b.height) - (a.width*a.height));

        finalDeviceList.push(obj);
    }

    return finalDeviceList;
  } 
  catch (err) {
    console.error('Probe failed:', err.message || err);
    return [];
  }
}

module.exports = {
    listDevices
};