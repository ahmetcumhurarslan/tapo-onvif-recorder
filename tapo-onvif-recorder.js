const CameraController = require('./CameraController');
const config = require('./config');
const videoServer = require('./videoServer');

var cameraControllers = [];


process.on('SIGINT', async () => {
    for (const cameraController of cameraControllers) {
        await cameraController.stop();
    }
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});


for (const cameraConfig of config.cameras) {
    const cameraController = new CameraController(cameraConfig);
    cameraControllers.push(cameraController);
}

videoServer.getStreamsFunction = () => {
    console.log("Getting streams from camera controllers...");
    var streams = [];
    for (const cameraController of cameraControllers) {
       var info = {
            source: cameraController.streamUri,
            name: cameraController.options.name
       }
       streams.push(info);
    }
    return streams;
}
