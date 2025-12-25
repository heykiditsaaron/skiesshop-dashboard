const express = require('express');
const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const { getBackupPath, getShopPath, getSftpConfig } = require('./sftp');

function buildRouter({ servers, currencies, credentials }) {
  const router = express.Router();

  const getServer = id => servers.find(s => s.id === id);

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/servers', (req, res) => {
    res.json(servers.map(s => ({ id: s.id, name: s.name })));
  });

  router.get('/currencies', (req, res) => {
    res.json(currencies || []);
  });

  router.get('/servers/:serverId/shops', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();

    try {
      await sftp.connect(getSftpConfig(server, credentials));
      const files = await sftp.list(server.basePath);

      const shops = files
        .filter(f => f.type === '-' && f.name.endsWith('.json'))
        .map(f => ({
          id: path.basename(f.name, '.json'),
          file: f.name
        }));

      res.json(shops);
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.get('/servers/:serverId/shops/:shopId', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopPath = getShopPath(server, req.params.shopId);

    try {
      await sftp.connect(getSftpConfig(server, credentials));
      const data = await sftp.get(shopPath);
      res.json(JSON.parse(data.toString('utf8')));
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.post('/servers/:serverId/shops/:shopId', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopId = req.params.shopId;
    const shopPath = getShopPath(server, shopId);
    const { backupDir, backupPath } = getBackupPath(server, shopId);

    try {
      await sftp.connect(getSftpConfig(server, credentials));

      try {
        await sftp.mkdir(backupDir, true);
      } catch {
        // ignore if exists or cannot create
      }

      const original = await sftp.get(shopPath);
      await sftp.put(original, backupPath);

      const json = JSON.stringify(req.body, null, 2);
      await sftp.put(Buffer.from(json, 'utf8'), shopPath);

      res.json({ status: 'saved', backup: path.posix.basename(backupPath) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.post('/servers/:serverId/shops', async (req, res) => {
    const { serverId } = req.params;
    const { shopId, title } = req.body;

    if (!shopId) {
      return res.status(400).json({ error: 'shopId is required' });
    }

    const server = getServer(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopPath = getShopPath(server, shopId);

    const template = {
      title: title || 'New Shop',
      type: 'GENERIC_9x6',
      entries: {}
    };

    try {
      await sftp.connect(getSftpConfig(server, credentials));

      try {
        await sftp.get(shopPath);
        return res.status(409).json({ error: 'Shop already exists' });
      } catch {
        // not found is expected
      }

      await sftp.put(
        Buffer.from(JSON.stringify(template, null, 2), 'utf8'),
        shopPath
      );

      res.json({ status: 'created', shopId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.delete('/servers/:serverId/shops/:shopId', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopId = req.params.shopId;
    const shopPath = getShopPath(server, shopId);
    const { backupDir, backupPath } = getBackupPath(server, shopId);

    try {
      await sftp.connect(getSftpConfig(server, credentials));

      try {
        await sftp.mkdir(backupDir, true);
      } catch {
        // ignore if exists or cannot create
      }

      const original = await sftp.get(shopPath);
      await sftp.put(original, backupPath);
      await sftp.delete(shopPath);

      res.json({
        status: 'deleted',
        backup: path.posix.basename(backupPath)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.post('/servers/:serverId/shops/:shopId/restore', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopId = req.params.shopId;
    const shopPath = getShopPath(server, shopId);
    const { backupDir } = getBackupPath(server, shopId);

    try {
      await sftp.connect(getSftpConfig(server, credentials));

      const files = await sftp.list(backupDir).catch(() => []);
      const backups = files
        .filter(f => f.type === '-' && f.name.startsWith(`${shopId}.bak.`))
        .sort((a, b) => b.modifyTime - a.modifyTime);

      const latest = backups[0];
      if (!latest) return res.status(404).json({ error: 'No backups found' });

      const backupPath = path.posix.join(backupDir, latest.name);
      const data = await sftp.get(backupPath);
      await sftp.put(data, shopPath);

      res.json({ status: 'restored', source: latest.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.get('/servers/:serverId/shops/:shopId/backups', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopId = req.params.shopId;
    const { backupDir } = getBackupPath(server, shopId);

    try {
      await sftp.connect(getSftpConfig(server, credentials));

      const files = await sftp.list(backupDir).catch(() => []);
      const backups = files
        .filter(f => f.type === '-' && f.name.startsWith(`${shopId}.bak.`))
        .sort((a, b) => b.modifyTime - a.modifyTime)
        .map(f => ({
          name: f.name,
          size: f.size,
          modifyTime: f.modifyTime
        }));

      res.json(backups);
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  router.post('/servers/:serverId/shops/:shopId/restore/:backupName', async (req, res) => {
    const server = getServer(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const sftp = new SftpClient();
    const shopId = req.params.shopId;
    const backupName = req.params.backupName;
    const shopPath = getShopPath(server, shopId);
    const { backupDir } = getBackupPath(server, shopId);

    try {
      await sftp.connect(getSftpConfig(server, credentials));

      const files = await sftp.list(backupDir).catch(() => []);
      const exists = files.some(f => f.type === '-' && f.name === backupName);
      if (!exists) return res.status(404).json({ error: 'Backup not found' });

      const backupPath = path.posix.join(backupDir, backupName);
      const data = await sftp.get(backupPath);
      await sftp.put(data, shopPath);

      res.json({ status: 'restored', source: backupName });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      sftp.end();
    }
  });

  return router;
}

module.exports = { buildRouter };
