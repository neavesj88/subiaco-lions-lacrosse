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
// Only the PORT, and only if something else on the same server is already
// using it. Everything else can be left alone.
// =============================================================================

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

        // The port the site listens on. 5000 is the default and is fine unless
        // something else on this server already uses it — if the site refuses
        // to start with an "address in use" error, change this to 5001, 5002
        // and so on, then update your nginx or tunnel settings to match.
        PORT: 5000,
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
