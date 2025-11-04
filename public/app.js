var allVideos = {};

function xhrGet(url, onSuccess, onError) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = JSON.parse(xhr.responseText);
            onSuccess(data);
          } catch (e) {
            if (onError) onError(e);
          }
        } else {
          if (onError) onError(new Error('HTTP status ' + xhr.status));
        }
      }
    };
    xhr.send(null);
  } catch (e) {
    if (onError) onError(e);
  }
}

function loadVideos(selectedDate) {
  var url = selectedDate ? '/api/videos?date=' + encodeURIComponent(selectedDate) : '/api/videos';
  try {
    if (window.console && console.log) console.log('Loading videos from: ' + url);
    xhrGet(url, function (data) {
      allVideos = data || {};
      try { if (window.console && console.log) console.log(JSON.stringify(allVideos, null, 2)); } catch (e) {}
      displayVideos(allVideos);
    }, function (err) {
      if (window.console && console.error) console.error('Failed to load videos:', err);
    });
  } catch (error) {
    if (window.console && console.error) console.error('Failed to load videos:', error);
  }
}

function setupDatePicker() {
  var datePicker = document.getElementById('datePicker');
  var prevButton = document.getElementById('prevDay');
  var nextButton = document.getElementById('nextDay');

  var today = new Date();
  var localDate = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

  // Some old browsers don't support input[type=date]; still set value attribute as fallback
  try { datePicker.value = localDate; } catch (e) { datePicker.setAttribute('value', localDate); }

  // Initial load: server expects dots (YYYY.MM.DD)
  loadVideos(localDate.replace(/-/g, '.'));

  if (datePicker.addEventListener) {
    datePicker.addEventListener('change', function (e) {
      var val = (e && e.target && e.target.value) ? e.target.value : datePicker.value || datePicker.getAttribute('value');
      if (val) loadVideos(val.replace(/-/g, '.'));
    }, false);
  }

  if (prevButton) {
    prevButton.addEventListener('click', function () {
      var cur = parseDateFromInput(datePicker);
      cur.setDate(cur.getDate() - 1);
      var iso = cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate());
      try { datePicker.value = iso; } catch (e) { datePicker.setAttribute('value', iso); }
      loadVideos(iso.replace(/-/g, '.'));
    }, false);
  }

  if (nextButton) {
    nextButton.addEventListener('click', function () {
      var cur = parseDateFromInput(datePicker);
      cur.setDate(cur.getDate() + 1);
      var iso = cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate());
      try { datePicker.value = iso; } catch (e) { datePicker.setAttribute('value', iso); }
      loadVideos(iso.replace(/-/g, '.'));
    }, false);
  }
}

function displayVideos(data) {
  var container = document.getElementById('dates-container');
  if (!container) return;
  container.innerHTML = '';

  var datePicker = document.getElementById('datePicker');
  var fallbackDate = datePicker && (datePicker.value || datePicker.getAttribute('value')) ? (datePicker.value || datePicker.getAttribute('value')) : null;
  var dateKey = Object.keys(data || {})[0] || (fallbackDate ? fallbackDate.replace(/-/g, '.') : '');

  var dateSection = document.createElement('div');
  dateSection.className = 'date-section';

  var dateHeader = document.createElement('h2');
  dateHeader.className = 'date-header';
  dateHeader.textContent = formatDate(dateKey);
  dateSection.appendChild(dateHeader);

  if (!data[dateKey] || Object.keys(data[dateKey]).length === 0) {
    var noVideoMessage = document.createElement('div');
    noVideoMessage.className = 'no-video-message';
    noVideoMessage.textContent = '----';
    dateSection.appendChild(noVideoMessage);
  } else {
    var cameras = data[dateKey];
    for (var camIdx = 0; camIdx < Object.keys(cameras).length; camIdx++) {
      var camera = Object.keys(cameras)[camIdx];
      var cameraSection = document.createElement('div');
      cameraSection.className = 'camera-section';

      var cameraHeader = document.createElement('h3');
      cameraHeader.className = 'camera-header';
      cameraHeader.textContent = camera;
      cameraSection.appendChild(cameraHeader);

      var videoGrid = document.createElement('div');
      videoGrid.className = 'video-grid';

      var list = cameras[camera] || [];
      for (var i = 0; i < list.length; i++) {
        var video = list[i];
        var card = createVideoCard(video);
        videoGrid.appendChild(card);
      }

      cameraSection.appendChild(videoGrid);
      dateSection.appendChild(cameraSection);
    }
  }

  container.appendChild(dateSection);
}

function createVideoCard(video) {
  var card = document.createElement('div');
  card.className = 'video-card';

  var thumbnailContainer = document.createElement('div');
  thumbnailContainer.className = 'thumbnail-container';

  var thumbnail = document.createElement('img');
  thumbnail.className = 'video-thumbnail';
  thumbnail.src = (video.path || '').replace('.mp4', '.jpg');
  thumbnail.alt = 'Video thumbnail';
  thumbnail.onerror = function () {
    thumbnail.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23666" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-10v6l5-3z"/></svg>';
  };

  var playButton = document.createElement('div');
  playButton.className = 'play-button';

  var timeDisplay = document.createElement('div');
  timeDisplay.className = 'time-display';
  timeDisplay.textContent = formatTime(video.name || '');

  thumbnailContainer.appendChild(thumbnail);
  thumbnailContainer.appendChild(playButton);
  thumbnailContainer.appendChild(timeDisplay);
  card.appendChild(thumbnailContainer);

  (function (path) {
    card.addEventListener('click', function () { openVideoModal(path); }, false);
  })(video.path || '');

  return card;
}

function openVideoModal(videoPath) {
  var modal = document.getElementById('videoModal');

  if (!modal) {
    modal = createVideoModal();
    document.body.appendChild(modal);
  }

  var videoEl = modal.querySelector('video');
  if (videoEl) {
    videoEl.src = videoPath;
    try { videoEl.play(); } catch (e) {}
  }

  if (modal.classList) modal.classList.add('active'); else modal.className += ' active';
}

function createVideoModal() {
  var modal = document.createElement('div');
  modal.id = 'videoModal';
  modal.className = 'video-modal';

  var modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  var video = document.createElement('video');
  video.className = 'modal-video';
  video.controls = true;

  var closeButton = document.createElement('button');
  closeButton.className = 'close-modal';
  closeButton.innerHTML = '\u00D7';
  closeButton.onclick = closeVideoModal;

  modalContent.appendChild(video);
  modalContent.appendChild(closeButton);
  modal.appendChild(modalContent);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeVideoModal();
  }, false);

  return modal;
}

function closeVideoModal() {
  var modal = document.getElementById('videoModal');
  if (modal) {
    var video = modal.querySelector('video');
    if (video) {
      try { video.pause(); } catch (e) {}
      video.src = '';
    }
    if (modal.classList) modal.classList.remove('active'); else modal.className = modal.className.replace(/\bactive\b/, '');
  }
}

// Add keyboard event listener for ESC key (fallback-safe)
document.addEventListener('keydown', function (e) {
  var key = e.key || e.keyIdentifier || e.which || e.keyCode;
  if (key === 'Escape' || key === 'Esc' || key === 27) closeVideoModal();
}, false);

function formatDate(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('.');
  if (parts.length < 3) return dateStr;
  var year = parts[0], month = parseInt(parts[1], 10), day = parseInt(parts[2], 10);
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[(month - 1) % 12] + ' ' + day + ', ' + year;
}

function formatTime(filename) {
  if (!filename) return '';
  var timeStr = filename.replace('.mp4', '');
  var parts = timeStr.split('-');
  if (parts.length < 3) return timeStr;
  var h = pad(parseInt(parts[0], 10));
  var m = pad(parseInt(parts[1], 10));
  var s = pad(parseInt(parts[2], 10));
  return h + ':' + m + ':' + s;
}

function pad(n) { n = parseInt(n, 10); return (isNaN(n) ? '00' : (n < 10 ? '0' + n : '' + n)); }

function parseDateFromInput(el) {
  var v = (el && (el.value || el.getAttribute('value'))) ? (el.value || el.getAttribute('value')) : '';
  var parts = v.split('-');
  var d = new Date();
  if (parts.length === 3) {
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return d;
}

// Run setup on DOM ready
if (document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () { setupDatePicker(); }, false);
} else {
  window.onload = setupDatePicker;
}
