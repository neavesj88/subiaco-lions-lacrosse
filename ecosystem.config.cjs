// =============================================================================
// PM2 SETTINGS — ecosystem.config.cjs
// =============================================================================
// WHAT THIS IS
// Instructions for PM2, a tool that keeps the website running and restarts it
// if it crashes. This file is only used on a RENTED SERVER.
//
// If you followed the clubhouse guide, you are not using PM2 — that setup uses
// systemd instead, and this file is ignored. See CLUBHOUSE_SETUP.md.
//
// SHOULD A CLUB EDIT THIS FILE?
// No. The port is set in .env (PORT=). Everything else can be left alone.
// =============================================================================

// The port comes from .env, the one place a club sets it (the site, PM2 and
// the tunnel scripts all read it there). A number written here instead would
// override .env and quietly put the site on a different port from the one
// nginx or the tunnel was pointed at.
require("dotenv").config({ path: __dirname + "/.env", quiet: true });

module.exports = {
  apps: [
    {
      // The name PM2 shows in `pm2 status` and uses in `pm2 restart <name>`.
      // Deliberately generic: change it only if you run more than one club
      // site on the same server and need to tell them apart.
      name: "club-website",

      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",

      env_production: {
        NODE_ENV: "production",

        // PORT in .env, else 5000. If the site refuses to start with an
        // "address in use" error, set PORT=5001 (or another free number) in
        // .env, then update your nginx or tunnel settings to match.
        PORT: Number(process.env.PORT) || 5000,
      },

      log_file: "/var/log/pm2/club-website.log",
      out_file: "/var/log/pm2/club-website.out",
      error_file: "/var/log/pm2/club-website.error",
      time: true,

      // Restart if the site ever uses more than this much memory, which almost
      // always means something has gone wrong rather than the club being busy.
      max_memory_restart: "512M",
    },
  ],
};
