// printer-service/ecosystem.config.js
module.exports = {
    apps: [{
        name: 'thermal-printer',
        script: './printer-service/server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3001
        },
        error_file: './logs/printer-error.log',
        out_file: './logs/printer-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true
    }]
}