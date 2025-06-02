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
