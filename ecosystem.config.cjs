module.exports = {
  apps: [
    {
      name: "lions-lacrosse",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        // Port 5001 so this can run ALONGSIDE neaves.au (which uses 5000)
        // on the same Ubuntu VM without conflict.
        PORT: 5001,
      },
      log_file: "/var/log/pm2/lions-lacrosse.log",
      out_file: "/var/log/pm2/lions-lacrosse.out",
      error_file: "/var/log/pm2/lions-lacrosse.error",
      time: true,
      max_memory_restart: "512M",
    },
  ],
};
