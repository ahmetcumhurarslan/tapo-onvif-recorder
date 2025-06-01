let allVideos = {};

async function loadVideos(selectedDate) {
    try {
        const url = selectedDate ? `/api/videos?date=${selectedDate}` : '/api/videos';
        console.log('Loading videos from:', url);
        const response = await fetch(url);
        allVideos = await response.json();
        console.log(JSON.stringify(allVideos, null, 2));
        displayVideos(allVideos);
    } catch (error) {
        console.error('Failed to load videos:', error);
    }
}

function setupDatePicker() {
    const datePicker = document.getElementById('datePicker');
    const prevButton = document.getElementById('prevDay');
    const nextButton = document.getElementById('nextDay');
    
    // Set today's date as default using local time
    const today = new Date();
    const localDate = today.getFullYear() + '-' + 
                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getDate()).padStart(2, '0');
    datePicker.value = localDate;
    
    // Load today's videos initially
    loadVideos(localDate.replace(/-/g, '.'));

    datePicker.addEventListener('change', (e) => {
        const selectedDate = e.target.value.replace(/-/g, '.');
        loadVideos(selectedDate);
    });

    prevButton.addEventListener('click', () => {
        const currentDate = new Date(datePicker.value);
        currentDate.setDate(currentDate.getDate() - 1);
        datePicker.value = currentDate.toISOString().split('T')[0];
        loadVideos(datePicker.value.replace(/-/g, '.'));
    });

    nextButton.addEventListener('click', () => {
        const currentDate = new Date(datePicker.value);
        currentDate.setDate(currentDate.getDate() + 1);
        datePicker.value = currentDate.toISOString().split('T')[0];
        loadVideos(datePicker.value.replace(/-/g, '.'));
    });
}

function displayVideos(data) {
    const container = document.getElementById('dates-container');
    container.innerHTML = '';
    
    const date = Object.keys(data)[0] || datePicker.value.replace(/-/g, '.');
    
    const dateSection = document.createElement('div');
    dateSection.className = 'date-section';
    
    const dateHeader = document.createElement('h2');
    dateHeader.className = 'date-header';
    dateHeader.textContent = formatDate(date);
    dateSection.appendChild(dateHeader);
    
    if (!data[date] || Object.keys(data[date]).length === 0) {
        const noVideoMessage = document.createElement('div');
        noVideoMessage.className = 'no-video-message';
        noVideoMessage.textContent = '----';
        dateSection.appendChild(noVideoMessage);
    } else {
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
    }
    
    container.appendChild(dateSection);
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'thumbnail-container';
    
    const thumbnail = document.createElement('img');
    thumbnail.className = 'video-thumbnail';
    thumbnail.src = video.path.replace('.mp4', '.jpg');
    thumbnail.alt = 'Video thumbnail';
    thumbnail.onerror = () => {
        thumbnail.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23666" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-10v6l5-3z"/></svg>';
    };
    
    const playButton = document.createElement('div');
    playButton.className = 'play-button';
    
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';
    timeDisplay.textContent = formatTime(video.name);
    
    thumbnailContainer.appendChild(thumbnail);
    thumbnailContainer.appendChild(playButton);
    thumbnailContainer.appendChild(timeDisplay);
    card.appendChild(thumbnailContainer);
    
    card.addEventListener('click', () => openVideoModal(video.path));
    
    return card;
}

function openVideoModal(videoPath) {
    let modal = document.getElementById('videoModal');
    
    if (!modal) {
        modal = createVideoModal();
        document.body.appendChild(modal);
    }
    
    const video = modal.querySelector('video');
    video.src = videoPath;
    video.play();
    
    modal.classList.add('active');
}

function createVideoModal() {
    const modal = document.createElement('div');
    modal.id = 'videoModal';
    modal.className = 'video-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const video = document.createElement('video');
    video.className = 'modal-video';
    video.controls = true;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-modal';
    closeButton.innerHTML = '×';
    closeButton.onclick = closeVideoModal;
    
    modalContent.appendChild(video);
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeVideoModal();
    });
    
    return modal;
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    if (modal) {
        const video = modal.querySelector('video');
        video.pause();
        video.src = '';
        modal.classList.remove('active');
    }
}

// Add keyboard event listener for ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeVideoModal();
});

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('.');
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat(navigator.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function formatTime(filename) {
    const timeStr = filename.replace('.mp4', '');
    const [hours, minutes, seconds] = timeStr.split('-');
    const date = new Date();
    date.setHours(hours, minutes, seconds);
    
    return new Intl.DateTimeFormat(navigator.language, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
}

document.addEventListener('DOMContentLoaded', () => {
    setupDatePicker();
});
