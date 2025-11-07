const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { customLog, ...config } = require('./config');
const cron = require('node-cron');
const {listPaths} = require('./mediamtxApi');
const { spawn } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const app = express();


app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/videos', async (req, res) => {
    try {
        const requestedDate = req.query.date; // Get date parameter from query
        const dateFolders = await fs.readdir(config.app.recordingsPath);
        const structure = {};

        for (const dateFolder of dateFolders) {
            // Skip if date parameter is provided and doesn't match
            if (requestedDate && dateFolder !== requestedDate) continue;

            const datePath = path.join(config.app.recordingsPath, dateFolder);
            const stat = await fs.stat(datePath);

            if (stat.isDirectory()) {
                const cameraDirs = await fs.readdir(datePath);
                structure[dateFolder] = {};

                for (const cameraDir of cameraDirs) {
                    const cameraPath = path.join(datePath, cameraDir);
                    const cameraStat = await fs.stat(cameraPath);

                    if (cameraStat.isDirectory()) {
                        const videos = (await fs.readdir(cameraPath))
                            .filter(file => file.endsWith('.mp4'))
                            .map(file => ({
                                name: file,
                                path: `/videos/${dateFolder}/${cameraDir}/${file}`
                            }));
                        structure[dateFolder][cameraDir] = videos;
                    }
                }
            }
        }
        res.json(structure);
    } catch (error) {
        console.error('Error listing videos:', error);
        res.status(500).json({ error: 'Failed to list videos' });
    }
});


app.get('/api/streams', async (req, res) => {
    try {
        var pathList = await listPaths();
        var list = [];
        for (const p of pathList) {
            var obj = {};
            obj.name = p.name;
            list.push(obj);
        }
        res.json(list);
    }
    catch (e) {
        res.json([]);
    }
});

var snapshotWorkers = {};
var controlSnapshotWorkersActive = false;
var snapshotPruneIntervalId = null;

function startSnapshotWorker(name) {
    if (snapshotWorkers[name]) {
        // refresh last request time
        snapshotWorkers[name].lastRequestTime = Date.now();
    } else {
        // create and start a new worker
        createSnapshotWorker(name);
    }

    if (!controlSnapshotWorkersActive) {
        controlSnapshotWorkers();
    }
}

function controlSnapshotWorkers() {
    if (controlSnapshotWorkersActive) return;
    controlSnapshotWorkersActive = true;
    // run prune every 30s to reduce churn
    snapshotPruneIntervalId = setInterval(() => {
        pruneSnapshotWorkers();
    }, 5 * 1000);
}

function pruneSnapshotWorkers() {
    console.log("Pruning snapshot workers...");
    const now = Date.now();
    for (const name in snapshotWorkers) {
        try {
            const wk = snapshotWorkers[name];
            if (!wk) continue;
            if (now - wk.lastRequestTime > 10 * 1000) {
                // terminate ffmpeg process if running and remove worker
                try {
                    if (wk.proc) {
                        try { wk.proc.kill('SIGTERM'); } catch (e) {}
                        // ensure it's not left
                        wk.proc = null;
                    }
                } catch (e) {}
                delete snapshotWorkers[name];

                console.log("---------------------------------------")
                console.log(`Pruned snapshot worker for ${name} due to inactivity`);
                console.log("---------------------------------------")
            }
        } catch (e) {
            // ignore per-worker errors
        }
    }
}

function createSnapshotWorker(name) {
    console.log(`Creating snapshot worker for ${name}`);
    // create a single continuous ffmpeg process that outputs MJPEG frames to stdout at ~1 fps
    const url = `rtsp://127.0.0.1:8554/${name}`;
    const worker = {
        lastRequestTime: Date.now(),
        snapshot: null,
        proc: null,
        restartDelay: 2000
    };

    // if a previous worker exists, ensure its process is killed before starting a new one
    if (snapshotWorkers[name] && snapshotWorkers[name].proc) {
        try { snapshotWorkers[name].proc.kill('SIGTERM'); } catch (e) {}
        try { snapshotWorkers[name].proc = null; } catch (e) {}
    }

    snapshotWorkers[name] = worker;

    const ff = spawn(ffmpegInstaller.path, [
        '-rtsp_transport', 'tcp',
        '-loglevel', 'error',
        '-i', url,
        '-r', '4',                 // 2 frames per second
        '-vf', 'scale=300:-1',    // resize frames
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        'pipe:1'
    ]);
    worker.proc = ff;

    let buffer = Buffer.alloc(0);

    ff.stdout.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        // extract complete JPEG frames from buffer
        let start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        let end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
        while (start !== -1 && end !== -1) {
            const frame = buffer.slice(start, end + 2);
            try {
                worker.snapshot = `data:image/jpeg;base64,${frame.toString('base64')}`;
                // reset restart delay on successful frame
                worker.restartDelay = 2000;
            } catch (e) {}
            // copy the remainder to avoid retaining large backing buffer
            buffer = Buffer.from(buffer.slice(end + 2));
            start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
            end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
        }
    });

    ff.stderr.on('data', (d) => {
        try { customLog('[video server]', `ffmpeg ${name} stderr: ${d.toString()}`); } catch (e) {}
    });

    ff.on('close', (code, signal) => {
        // mark proc gone
        worker.proc = null;
        // if worker still exists (not pruned) try to restart after delay with backoff
        if (snapshotWorkers[name]) {
            const delay = worker.restartDelay || 2000;
            setTimeout(() => {
                if (snapshotWorkers[name]) createSnapshotWorker(name);
            }, delay);
            // exponential-ish backoff, cap at 30s
            worker.restartDelay = Math.min((worker.restartDelay || 2000) * 2.5, 30000);
        }
    });

    ff.on('error', (err) => {
        worker.proc = null;
        try { customLog('[video server]', `ffmpeg ${name} error: ${err && err.message}`); } catch (e) {}
    });
}

app.get('/api/snapshot/:name', async (req, res) => {
    //console.log("Snapshot request received");
    const name = req.params.name;
    if (!name) return res.status(400).json({ error: 'Missing name parameter' });
    
    startSnapshotWorker(name);
    if(snapshotWorkers[name] && snapshotWorkers[name].snapshot){
        res.json({ snapshot: snapshotWorkers[name].snapshot });
    }
    else {
        const emptyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
        res.json({ snapshot: emptyImage });
    }
}); 


app.get('/api/logs', async (req, res) => {
    try {
        const logPath = path.join(os.homedir(), '.pm2/logs/tapo-onvif-recorder-out.log');
        const logs = await fs.readFile(logPath, 'utf8');
        res.json({ logs: logs.split('\n').reverse() });
    } catch (error) {
        console.error('Error reading logs:', error);
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

app.use('/videos', express.static(config.app.recordingsPath));

const server = app.listen(config.server.port, config.server.host, () => {
    customLog("[video server]", 'Server is running on:');
    customLog("[video server]", `Local: http://localhost:${config.server.port}`);

    const networkAddresses = getLocalIpAddresses();
    networkAddresses.forEach(ip => {
        customLog("[video server]", `Network: http://${ip}:${config.server.port}`);
    });
    customLog("[video server]", 'Use any of these addresses to access from other computers on the LAN');
});

function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                addresses.push(addr.address);
            }
        }
    }
    return addresses;
}

// Compute total size of the recordings folder (bytes). Accept optional root folder.
async function getRecordingsFolderSize() {
    async function sizeOf(dir) {
        let total = 0;
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    total += await sizeOf(full);
                } else if (entry.isFile()) {
                    try {
                        const stat = await fs.stat(full);
                        total += stat.size;
                    } catch (err) {
                        // ignore individual file errors
                    }
                }
            }
        } catch (err) {
            // if folder doesn't exist or other error, return 0
        }
        return total;
    }

    return await sizeOf(config.app.recordingsPath);
}

async function getOldestDayFolder() {
    const recordingsRoot = config.app.recordingsPath;
    try {
        const entries = await fs.readdir(recordingsRoot, { withFileTypes: true });
        const folders = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const folderPath = path.resolve(recordingsRoot, entry.name);
            let stat;
            try {
                stat = await fs.stat(folderPath);
            } catch (err) {
                continue;
            }
            folders.push({ path: folderPath, mtimeMs: stat.mtimeMs});
        }

        // sort by oldest first
        folders.sort((a, b) => b.mtimeMs - a.mtimeMs);

        return folders.length > 0 ? folders[0].path : null;
    } 
    catch (err) {
        customLog('[video server]', 'deleteOldestDayFoldersUntilUnderLimit error', err);
        return null;
    }
}

async function controlRecordingsSize() {
    customLog('[video server]', 'Checking recordings folder size for pruning...');
    const defaultLimit = 10; // GB
    const limit = config.app.storageLimit ? config.app.storageLimit : defaultLimit;
    customLog('[video server]', `Using storage limit: ${limit} GB`);
    while(await getRecordingsFolderSize() > (limit*1024*1024*1024)){
        var oldestFolder = await getOldestDayFolder();
        if(!oldestFolder){
            break;
        }
        try {
            if (fs.rm) {
                await fs.rm(oldestFolder, { recursive: true, force: true });
            } else {
                await fs.rmdir(oldestFolder, { recursive: true });
            }
            customLog('[video server]', `Deleted oldest folder: ${oldestFolder}`);
        } catch (err) {
            customLog('[video server]', `Failed to delete folder ${oldestFolder}:`, err);
            break;
        }   
    }
}

// Schedule controlRecordingsSize to run at 00:00 every day using cron expression
const timezone = config.app && config.app.timezone ? config.app.timezone : undefined;
cron.schedule('0 0 * * *', () => {
    controlRecordingsSize().catch(err => customLog('[video server]', 'Daily prune failed', err));
}, { scheduled: true, timezone });

// start an immediate check at startup as well
controlRecordingsSize().catch(err => customLog('[video server]', 'Startup prune failed', err));



process.on('SIGINT', () => {
    customLog("[video server]", 'Shutting down server...');
    // kill any running ffmpeg procs
    try {
        for (const name in snapshotWorkers) {
            try {
                const wk = snapshotWorkers[name];
                if (wk && wk.proc) {
                    try { wk.proc.kill('SIGTERM'); } catch (e) { try { wk.proc.kill('SIGKILL'); } catch (e) {} }
                    wk.proc = null;
                }
            } catch (e) {}
        }
    } catch (e) {}

    // clear prune interval
    try { if (snapshotPruneIntervalId) clearInterval(snapshotPruneIntervalId); } catch (e) {}

    server.close(() => {
        customLog("[video server]", 'Server closed');
        process.exit(0);
    });
});

// Export the app for testing or further configuration
module.exports = app;

