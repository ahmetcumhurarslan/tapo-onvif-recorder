const CameraController = require('./CameraController');
const config = require('./config');
const videoServer = require('./videoServer');
const onvifScanner = require('./onvifScanner');
const { addPath } = require("./mediamtxApi");

const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://localhost");

//============================
// GLOBAL STATE
//============================
const cameraControllers = {};      // cameraSerial → CameraController
const cameraMotionStates = {};     // cameraSerial → {motionDetected}
const plugStates = {};             // plugMac → {status,lastSignalTime}
//============================


//============================
// CLEAN SHUTDOWN
//============================
process.on('SIGINT', async () => {
    for (const name in cameraControllers) {
        await cameraControllers[name].stop();
    }
    setTimeout(() => process.exit(0), 1000);
});
//============================


//============================
// MQTT SETUP
//============================
client.on("connect", () => {
    console.log("✅ MQTT connected");

    // Listen to all plug status messages
    // Example: /smartPlugs/<mac>/status
    client.subscribe("/smartPlugs/+/status");
});

client.on("message", (topic, message) => {
    console.log(`📩 MQTT: ${topic} → ${message.toString()}`);

    // Must match "/smartPlugs/<mac>/status"
    const parts = topic.split("/");
    if (parts.length === 4 && parts[1] === "smartPlugs" && parts[3] === "status") {
        const plugMac = parts[2];
        plugStates[plugMac] = {
            status: message.toString(),
            lastSignalTime: new Date()
        };
    }
});
//============================





//============================
// MOTION CALLBACK
//============================
function turnOnAllPlugs() {
    console.log("Turning ON all plugs due to motion detection...");
    for (const plugMac in plugStates) {
        console.log(`Turning ON plug ${plugMac}`);
        client.publish(`/smartPlugs/${plugMac}`, "turnon");
    }
}
function turnOffAllPlugs() {
    console.log("Turning OFF all plugs as no motion detected...");
    for (const plugMac in plugStates) {
        console.log(`Turning OFF plug ${plugMac}`);
        client.publish(`/smartPlugs/${plugMac}`, "turnoff");
    }
}
function motionStatusChangedCallback(cameraName, motionDetected) {
    cameraMotionStates[cameraName] = { motionDetected };
    if (motionDetected) {
        turnOnAllPlugs();
        return;
    }
    // If any camera still has motion → do NOT turn off
    for (const cam in cameraMotionStates) {
        if (cameraMotionStates[cam].motionDetected) return;
    }
    turnOffAllPlugs();
}

let turnedOn = false;
setInterval(() => {
   if(turnedOn){
       turnOffAllPlugs();
       turnedOn = false;
   } else {
       turnOnAllPlugs();
       turnedOn = true;
   } 
}, 10000);
//============================


//============================
// CAMERA CONTROLLER CREATION
//============================
async function addCameraController(device) {

    // Pick the first available stream
    const selectedStream = device.streams.length > 0 ? device.streams[0].url : null;
    if (!selectedStream) return;

    await addPath(device.serialNumber, selectedStream, {
        sourceOnDemand: true,
        sourceOnDemandStartTimeout: "10s",
        sourceOnDemandCloseAfter: "10s"
    });

    const localRtspPath = `rtsp://127.0.0.1:8554/${device.serialNumber}`;

    const cameraConfig = {
        hostname: device.hostname,
        port: device.port,
        username: config.onvif.username,
        password: config.onvif.password,
        timeout: config.onvif.timeout,
        name: device.serialNumber,
        streamUri: localRtspPath,
        motionStatusChangedCallback
    };

    const controller = new CameraController(cameraConfig);
    cameraControllers[device.serialNumber] = controller;
}
//============================


//============================
// CAMERA SCANNING
//============================
async function controlOnlineCameras() {
    const devices = await onvifScanner.listDevices();
    for (const device of devices) {
        if (!cameraControllers[device.serialNumber]) {
            addCameraController(device);
        }
    }
}

// Run initial detection after 10s
setTimeout(controlOnlineCameras, 10 * 1000);
// Then scan every 60s
setInterval(controlOnlineCameras, 60 * 1000);