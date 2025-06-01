const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const config = require('./config');

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

/*
app.get('/api/streams', (req, res) => {
    var streams = [];
    for( const cameraController of cameraControllers) {
        if (cameraController.streamUri) {
            streams.push({
                name: cameraController.options.username,
                highResUrl: cameraController.streamUri,
                lowResUrl: cameraController.streamUri.split("stream1")[0] + "stream2"
            });
        }
    }
    console.log('Available streams:', JSON.stringify(streams, null, 2));
    res.json(streams);
});
*/

app.use('/videos', express.static(config.app.recordingsPath));

const server = app.listen(config.server.port, config.server.host, () => {
    console.log('\nServer is running on:');
    console.log(`Local: http://localhost:${config.server.port}`);
    
    const networkAddresses = getLocalIpAddresses();
    networkAddresses.forEach(ip => {
        console.log(`Network: http://${ip}:${config.server.port}`);
    });
    console.log('\nUse any of these addresses to access from other computers on the LAN');
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

process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Export the app for testing or further configuration
module.exports = app;