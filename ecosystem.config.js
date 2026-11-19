// pm2 start ecosystem.config.js   (run from the repo root on the server)
module.exports = {
  apps: [
    {
      name: 'tickets-api',
      cwd: './api',
      script: './dist/main.js',
      // Keep ONE instance: the expiry cron and login rate-limit live in-process
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
    {
      name: 'tickets-web',
      cwd: './web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3000 --hostname 127.0.0.1',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
    },
  ],
};
