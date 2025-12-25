const path = require('path');

function getShopPath(server, shopId) {
  return path.posix.join(server.basePath, `${shopId}.json`);
}

function getBackupPath(server, shopId) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.posix.join(server.basePath, 'backups');
  const backupPath = path.posix.join(backupDir, `${shopId}.bak.${ts}`);
  return { backupDir, backupPath };
}

function getSftpConfig(server, credentials) {
  return {
    host: server.host,
    port: server.port,
    ...credentials
  };
}

module.exports = {
  getBackupPath,
  getShopPath,
  getSftpConfig
};
