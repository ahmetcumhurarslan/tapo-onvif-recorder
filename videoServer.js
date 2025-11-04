const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { customLog, ...config } = require('./config');
const cron = require('node-cron');

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


app.get('/api/streams', (req, res) => {
    try {
        if (app.getStreamsFunction) {
            var streams = app.getStreamsFunction();
            res.json(streams);
        }
        else {
            res.json([]);
        }
    }
    catch (e) {
        res.json([]);
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
    server.close(() => {
        customLog("[video server]", 'Server closed');
        process.exit(0);
    });
});

// Export the app for testing or further configuration
module.exports = app;

