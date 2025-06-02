const C320WSEventMonitor = require('./C320WSEventMonitor');
const fs = require('fs');
const dateFormat = require('dateformat').default;  // Changed to import default export
const StreamRecorder = require('./streamRecorder'); // Assuming you have a streamRecorder module
const { customLog, ...config } = require('./config');

class CameraController {
    constructor(options) {
        this.options = options;
        this.cam = null;
        this.isConnected = false;
        this.connectionControlInterval = null;
        this.recorder = new StreamRecorder(options);

        this.connect();
    }

    stop() {
        if (this.cam) {
            this.cam.stop();
            this.cam = null;
        }
        if (this.connectionControlInterval) {
            clearInterval(this.connectionControlInterval);
        }

        this.recorder.stopRecording((err) => {});
    }

    connect() {
        this.cam = new C320WSEventMonitor(this.options, (err) => {
            if (err) {
                this.disconnected(err.message);
            }
            else {
                this.connected();

                this.cam.eventOccured = () => {
                    this.resetConnectionControlInterval();
                };

                this.cam.motionDetectedCallback = () => {
                    this.resetConnectionControlInterval();
                    this.log('--> 🚨 Motion detected!');

                    this.startRecording();
                }

                this.cam.motionDetectedEndCallback = () => {
                    this.resetConnectionControlInterval();
                    this.log("--> motion detection end...");

                    this.stopRecording();
                }

                setTimeout(() => {
                    this.cam.startEventMonitoring();
                }, 5000);


                this.cam.getStreamUri({ protocol: 'RTSP' }, (err, stream, xml) => {

                    if (err) {
                        this.log(err);
                        this.streamUri = null;
                    }
                    else {
                        var group = stream.uri.split("rtsp://");
                        this.streamUri = "rtsp://" + this.options.username + ":" + this.options.password + "@" + group[1];

                        this.log('------------------------------');
                        this.log('Stream: ' + this.streamUri);
                        this.log('------------------------------');
                    }
                });
            }
        });
    }

    reconnect() {
        this.stop();
        setTimeout(() => {
            this.log("reconnecting to camera...");
            this.connect();
        }, 5000);
    }

    connected() {
        this.isConnected = true;
        this.connectedCallback();
        this.resetConnectionControlInterval();
    }

    resetConnectionControlInterval() {
        if (this.connectionControlInterval) {
            clearInterval(this.connectionControlInterval);
        }
        this.connectionControlInterval = setInterval(() => {
            this.controlConnection()
                .catch(error => {
                    this.disconnected(error.message);
                });
        }, 5000);
    }

    disconnected(error) {
        this.isConnected = false;
        if (this.connectionControlInterval) {
            clearInterval(this.connectionControlInterval);
            this.connectionControlInterval = null;
        }
        this.disconnectedCallback();
        this.connectionErrorCallback(error ? error : "");
        this.reconnect();
    }


    controlConnection() {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 1000)
        );

        const connectionCheck = new Promise((resolve, reject) => {
            this.cam.getHostname((err, data) => {
                if (err) {
                    reject(new Error('Connection lost'));
                }
                else {
                    this.isConnected = true;
                    resolve(true);
                }
            });
        });

        return Promise.race([connectionCheck, timeout]);
    }

    connectedCallback() {
        this.log("");
        this.log('✅ Connected to C320WS camera');
    }

    disconnectedCallback() {
        this.log('❌ Disconnected from C320WS camera');
    }

    connectionErrorCallback(error) {
        this.log('❌ Connection error:', error);
    }

    startRecording() {
        const recordPath = config.app.recordingsPath;
        var d = new Date();
        var filePath = recordPath
        filePath += "/"
        filePath += dateFormat(d, "yyyy.mm.dd");
        filePath += "/"
        filePath += this.options.username;

        // Ensure directory exists
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }

        filePath += "/"
        filePath += dateFormat(d, "HH-MM-ss");
        filePath += ".mkv"

        this.recorder.startRecording(this.streamUri, filePath, (err) => {
            if (err) {
                console.error('❌ Failed to start recording:', err.message);
            } else {
                this.log('🎥 Recording started: ' + filePath);
            }
        });
    }

    stopRecording() {
        this.recorder.stopRecording((err) => {
            if (err) {
                console.error('❌ Failed to stop recording:', err.message);
            } else {
                this.log('🎥 Recording stopped');
            }
        });
    }

    log(...message) {
        customLog(`[${this.options.username}]`, ...message);
    }

}


module.exports = CameraController;