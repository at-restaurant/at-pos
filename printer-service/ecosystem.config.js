// ============================================
// FILE: printer-service/ecosystem.config.js
// PM2 Configuration for Production
// ============================================

module.exports = {
    apps: [{
        name: 'thermal-printer',
        script: './server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '200M',
        env: {
            NODE_ENV: 'production',
            PORT: 3001,
            ALLOWED_ORIGINS: 'http://localhost:3000,http://192.168.1.100:3000'
        },
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true,

        // Restart policy
        min_uptime: '10s',
        max_restarts: 10,
        restart_delay: 4000,

        // Cron restart (daily at 3 AM)
        cron_restart: '0 3 * * *',

        // Kill timeout
        kill_timeout: 5000
    }]
};