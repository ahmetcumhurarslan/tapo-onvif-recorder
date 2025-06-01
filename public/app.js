async function loadVideos() {
    try {
        const response = await fetch('/api/videos');
        const data = await response.json();
        const container = document.getElementById('dates-container');
        
        // Sort dates in descending order
        const dates = Object.keys(data).sort((a, b) => b.localeCompare(a));
        
        dates.forEach(date => {
            const dateSection = document.createElement('div');
            dateSection.className = 'date-section';
            
            const dateHeader = document.createElement('h2');
            dateHeader.className = 'date-header';
            dateHeader.textContent = formatDate(date);
            dateSection.appendChild(dateHeader);
            
            const cameras = data[date];
            Object.keys(cameras).forEach(camera => {
                const cameraSection = document.createElement('div');
                cameraSection.className = 'camera-section';
                
                const cameraHeader = document.createElement('h3');
                cameraHeader.className = 'camera-header';
                cameraHeader.textContent = camera;
                cameraSection.appendChild(cameraHeader);
                
                const videoGrid = document.createElement('div');
                videoGrid.className = 'video-grid';
                
                cameras[camera].forEach(video => {
                    const card = createVideoCard(video);
                    videoGrid.appendChild(card);
                });
                
                cameraSection.appendChild(videoGrid);
                dateSection.appendChild(cameraSection);
            });
            
            container.appendChild(dateSection);
        });
    } catch (error) {
        console.error('Failed to load videos:', error);
    }
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    
    const videoElement = document.createElement('video');
    videoElement.controls = true;
    videoElement.src = video.path;
    
    const info = document.createElement('div');
    info.className = 'video-info';
    
    const time = document.createElement('div');
    time.className = 'video-time';
    time.textContent = formatTime(video.name);
    
    info.appendChild(time);
    card.appendChild(videoElement);
    card.appendChild(info);
    
    return card;
}

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('.');
    return `${day}/${month}/${year}`;
}

function formatTime(filename) {
    return filename.replace('.mkv', '').replace(/-/g, ':');
}

document.addEventListener('DOMContentLoaded', loadVideos);
