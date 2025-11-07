const CameraController = require('./CameraController');
const config = require('./config');
const videoServer = require('./videoServer');
const onvifScanner = require('./onvifScanner');

const { addPath, deleteAllPaths, getPath } = require("./mediamtxApi");

var cameraControllers = [];


process.on('SIGINT', async () => {
    for (const cameraController of cameraControllers) {
        await cameraController.stop();
    }
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});



(async () => {

    const devices = await onvifScanner.listDevices();
    //console.log('device list:', JSON.stringify(devices,null,4) );

    await deleteAllPaths();
    for (const device of devices) {
   
        var selectedStream = null;
        for (const stream of device.streams) {
            if(stream.width * stream.height <= 1280*720){
                selectedStream = stream.url;
                break;
            }
        }

        //var lowestStream = device.streams[device.streams.length - 1].url;
        await addPath(device.serialNumber, selectedStream, {
            sourceOnDemand: true,
            sourceOnDemandStartTimeout: "10s",
            sourceOnDemandCloseAfter: "10s"
        });


        var currentPath = "rtsp://127.0.0.1:8554/" + device.serialNumber;


        var cameraConfig = {
            hostname: device.hostname,
            port: device.port,
            username: config.onvif.username,
            password: config.onvif.password,
            timeout: config.onvif.timeout,
            name: device.serialNumber,
            streamUri: currentPath
        }

        const cameraController = new CameraController(cameraConfig);
        cameraControllers.push(cameraController);
    }

})();






