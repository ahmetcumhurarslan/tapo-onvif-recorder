const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const CameraController = require('./CameraController');
const config = require('./config');

const app = express();
const PORT = 3000;

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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/videos', async (req, res) => {
    try {
        const dateFolders = await fs.readdir(config.app.recordingsPath);
        const structure = {};

        for (const dateFolder of dateFolders) {
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
        console.log('Video structure:', JSON.stringify(structure, null, 2));
        res.json(structure);
    } catch (error) {
        console.error('Error listing videos:', error);
        res.status(500).json({ error: 'Failed to list videos' });
    }
});

app.use('/videos', express.static(config.app.recordingsPath));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
