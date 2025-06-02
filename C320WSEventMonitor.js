const { Cam } = require('onvif');
const { customLog } = require('./config');


class C320WSEventMonitor extends Cam {
    constructor(config, callback) {
        super(config, callback);
        this.isRunning = false;
        this.motionPresent = false;
        this.options = config;
    }

    startEventMonitoring() {
        this.log('🔄 Starting event monitoring...');

        this.on('event', (event) => {
            this.handleEvent(event);
        });

        this.on('error', (error) => {
            console.error('❌ Event error:', error);
        });

        this.isRunning = true;
        this.log('✅ Event monitoring started!');
    }

    handleEvent(eventData) {
        this.eventOccured(eventData);
        try {
            var item = eventData.message.message.data.simpleItem.$
            if (item.Name === "IsMotion") {
                this.handleMotionEvent(item.Value);
            }
        }
        catch (err) {
            console.error('❌ Error handling event:', err);
        }
    }

    eventOccured(eventData) { }

    handleMotionEvent(value) {
        if (value) {
            this.lastMotionDetectedTime = new Date();
        }
        else {
            this.lastMotionDetectedEndTime = new Date();
        }

        if (this.motionPresent !== value) {
            if (value) {
                this.motionPresent = true;
                this.motionDetectedCallback();
            }
            else {
                this.controlMotionEnd();
            }
        }
    }

    controlMotionEnd() {
        if (this.motionDetectedEndCallbackTimeout) {
            clearTimeout(this.motionDetectedEndCallbackTimeout);
        }
        this.motionDetectedEndCallbackTimeout = setTimeout(() => {
            if (this.motionPresent === true) {
                if (this.lastMotionDetectedEndTime > this.lastMotionDetectedTime) {
                    this.motionPresent = false;
                    this.motionDetectedEndCallback();
                }
            }
        }, 10000);
    }

    motionDetectedCallback() {
        this.log('🚨 Motion detected!');
    }

    motionDetectedEndCallback() {
        this.log("motion detection end...");
    }

    async stop() {
        this.log('🛑 Stopping event monitoring...');
        this.isRunning = false;

        this.removeAllListeners('event');
        this.removeAllListeners('error');

        if (this.motionDetectedEndCallbackTimeout) {
            clearTimeout(this.motionDetectedEndCallbackTimeout);
            this.motionDetectedEndCallbackTimeout = null;
        }

        this.log('✅ Event listeners removed.');

    }


    getDeviceInfo() {
        return new Promise((resolve, reject) => {
            this.getDeviceInformation((err, info) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(info);
                }
            });
        });
    }

    log(...message) {
        customLog(`[${this.options.username}]`, ...message);
    }

}

module.exports = C320WSEventMonitor;