<script>
function loadLogs() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/logs', true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var logsContainer = document.getElementById('logs');
    if (!logsContainer) return;

    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        var data = JSON.parse(xhr.responseText);
      } catch (e) {
        console.error('Invalid JSON', e);
        logsContainer.textContent = 'Invalid response';
        return;
      }

      logsContainer.innerHTML = '';
      var logs = data.logs || [];
      for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        if (String(log).trim()) {
          var logEntry = document.createElement('div');
          logEntry.className = 'log-entry';
          logEntry.textContent = log;
          logsContainer.appendChild(logEntry);
        }
      }
    } else {
      console.error('Failed to load logs, status:', xhr.status);
      logsContainer.textContent = 'Failed to load logs';
    }
  };
  xhr.send();
}

document.addEventListener('DOMContentLoaded', function () {
  loadLogs();
  var refreshButton = document.getElementById('refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', loadLogs);
  }
});
</script>
