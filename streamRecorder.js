// recorder.js
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { customLog } = require('./config');

class StreamRecorder {
    constructor(options) {
        this.options = options || { name: 'StreamRecorder' };
        this.ffmpegProcess = null;
    }

    startRecording(rtspUrl, outputPath, callback) {
        if (this.ffmpegProcess) {
            return callback(new Error('Recording already in progress'));
        }

        fs.mkdir(path.dirname(outputPath), { recursive: true }, (err) => {
            if (err) return callback(err);

            var args = [
                "-y",
                "-rtsp_transport", "tcp",
                "-use_wallclock_as_timestamps", "1",  // Duvar saati zaman damgasını kullan
                "-i", rtspUrl,
                "-c:v", "copy",
                "-c:a", "aac",
                "-f", "matroska",
                outputPath
            ];

            this.ffmpegProcess = spawn(ffmpegInstaller.path, args);

            let started = false;

            this.ffmpegProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                if (!started && msg.includes('Press [q] to stop')) {
                    started = true;
                    this.log('Recording started for ' + rtspUrl);
                    callback(null);
                }
            });

            this.ffmpegProcess.on('close', (code, signal) => {
                this.log(`Recording ended (code: ${code}, signal: ${signal})`);
                this.ffmpegProcess = null;
            });

            this.ffmpegProcess.on('error', (err) => {
                this.ffmpegProcess = null;
                callback(err);
            });
        });
    }

    generateThumbnail(videoPath, callback) {
        const thumbnailPath = videoPath.replace('.mp4', '.jpg');
        const args = [
            '-i', videoPath,
            '-vf', 'thumbnail,scale=640:360',
            '-frames:v', '1',
            thumbnailPath
        ];

        this.log("ffmpegInstaller.path:", ffmpegInstaller.path);
        this.log("args:", args);
        
        const thumbnailProcess = spawn(ffmpegInstaller.path, args);

        thumbnailProcess.on('close', (code) => {
            if (code === 0) {
                this.log('Thumbnail generated successfully');
                callback(null, thumbnailPath);
            } else {
                callback(new Error(`Thumbnail generation failed with code ${code}`));
            }
        });

        thumbnailProcess.on('error', (err) => {
            callback(err);
        });
    }

    convertToMp4(inputPath, callback) {
        const outputPath = inputPath.replace(/\.[^.]+$/, '.mp4');
        const args = [
            '-i', inputPath,
            '-c:v', 'copy',
            '-c:a', 'aac',
            outputPath
        ];

        const convertProcess = spawn(ffmpegInstaller.path, args);

        convertProcess.on('close', (code) => {
            if (code === 0) {
                this.log('Conversion completed successfully');
                // Delete the original file
                fs.unlink(inputPath, (err) => {
                    if (err) {
                        this.log('Error deleting original file: ' + err);
                        return callback(err);
                    }
                    // Generate thumbnail after successful conversion
                    this.generateThumbnail(outputPath, (err) => {
                        if (err) {
                            this.log('Thumbnail generation error: ' + err);
                            // Continue even if thumbnail generation fails
                        }
                        callback(null, outputPath);
                    });
                });
            } else {
                callback(new Error(`Conversion failed with code ${code}`));
            }
        });

        convertProcess.on('error', (err) => {
            callback(err);
        });
    }

    stopRecording(callback) {
        if (!this.ffmpegProcess) {
            return callback(null);
        }

        const currentOutput = this.ffmpegProcess.spawnargs[this.ffmpegProcess.spawnargs.length - 1];

        this.ffmpegProcess.once('close', () => {
            this.log('Recording stopped');
            // Convert to MP4 after stopping
            this.convertToMp4(currentOutput, (err, outputPath) => {
                if (err) {
                    this.log('Conversion error: ' + err);
                    return callback(err);
                }
                callback(null, outputPath);
            });
        });

        this.ffmpegProcess.kill('SIGINT');
    }

    log(...message) {
        customLog(`[${this.options.name}]`, ...message);
    }
}

module.exports = StreamRecorder;