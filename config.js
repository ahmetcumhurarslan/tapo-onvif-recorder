const config = {
    // Camera configurations
    cameras: [
        {
            hostname: '192.168.1.10',
            port: 2020,
            username: 'bahce1',
            password: 'bahce123123',
            timeout: 5000
        }
    ],
    
    // Server settings (for future use)
    server: {
        port: 3000,
        host: '0.0.0.0'  // Changed from 'localhost' to listen on all interfaces
    },
    
    // Application settings (for future use)
    app: {
        recordingsPath: './recordings'
    }
};

module.exports = config;
