async function loadLogs() {
    try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        const logsContainer = document.getElementById('logs');
        logsContainer.innerHTML = '';
        
        data.logs.forEach(log => {
            if (log.trim()) {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.textContent = log;
                logsContainer.appendChild(logEntry);
            }
        });
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadLogs();
    
    const refreshButton = document.getElementById('refresh');
    refreshButton.addEventListener('click', loadLogs);
});
