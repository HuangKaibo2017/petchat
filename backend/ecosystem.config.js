module.exports = {
  apps: [
    {
      name: 'petchat-api',
      script: 'server.js',
      cwd: '/opt/petchat-api',
      watch: false,
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: '8001',
        JWT_SECRET: 'petchat_prod_jwt_8d7f2a1c4e6b9f03a5d8c2e7f1b4a690',
        LLM_API_KEY: 'sk-5573a45cca2b4f28b2469460de3cdada',
        LLM_API_URL: 'https://api.deepseek.com/v1/chat/completions',
        LLM_MODEL: 'deepseek-chat',
        SUPABASE_URL: 'https://dlvgbwyvxjdggxpddpod.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsdmdid3l2eGpkZ2d4cGRkcG9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAwODU1NiwiZXhwIjoyMDk2NTg0NTU2fQ.br25FNrSLHrINq7C9axhd4i6qPPkAAn3DCtydmD_kO8',
        DB_SSL_REJECT_UNAUTHORIZED: 'false',
        WECHAT_APPID: 'wx67bdea24d2893ced',
        WECHAT_SECRET: '6d1968027f3adad629ded6016ca13c75',
      },
      error_file: '/root/.pm2/logs/petchat-api-error.log',
      out_file: '/root/.pm2/logs/petchat-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M',
      restart_delay: 3000,
    },
  ],
}
