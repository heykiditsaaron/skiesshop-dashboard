require('dotenv').config();

const express = require('express');
const SftpClient = require('ssh2-sftp-client');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

/**
 * Global SFTP credentials
 */
const GLOBAL_SFTP = {
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD
};

/**
 * Load servers from .env
 */
function loadServersFromEnv() {
  const servers = [];

  const serverIndices = Object.keys(process.env)
    .map(k => {
      const m = k.match(/^SERVER_(\d+)_ID$/);
      return m ? Number(m[1]) : null;
    })
    .filter(n => n !== null)
    .sort((a, b) => a - b);

  for (const index of serverIndices) {
    const p = `SERVER_${index}_`;
    const id = process.env[`${p}ID`];
    const name = process.env[`${p}NAME`];
    const host = process.env[`${p}HOST`];
    const port = process.env[`${p}PORT`];
    const basePath = process.env[`${p}BASE_PATH`];

    if (!id || !name || !host || !port || !basePath) continue;

    servers.push({
      id,
      name,
      host,
      port: Number(port),
      basePath
    });
  }

  return servers;
}

const servers = loadServersFromEnv();

/**
 * Helpers
 */
function getServer(id) {
  return servers.find(s => s.id === id);
}

function getShopPath(server, shopId) {
  return path.posix.join(server.basePath, `${shopId}.json`);
}

function getBackupPath(shopPath) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${shopPath}.bak.${ts}`;
}

function getSftpConfig(server) {
  return {
    host: server.host,
    port: server.port,
    ...GLOBAL_SFTP
  };
}

/**
 * Routes
 */
app.get('/', (req, res) => {
  res.send('Shop Dashboard is running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/servers', (req, res) => {
  res.json(servers.map(s => ({ id: s.id, name: s.name })));
});

/**
 * List shops
 */
app.get('/api/servers/:serverId/shops', async (req, res) => {
  const server = getServer(req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const sftp = new SftpClient();

  try {
    await sftp.connect(getSftpConfig(server));
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

/**
 * Read shop
 */
app.get('/api/servers/:serverId/shops/:shopId', async (req, res) => {
  const server = getServer(req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const sftp = new SftpClient();
  const shopPath = getShopPath(server, req.params.shopId);

  try {
    await sftp.connect(getSftpConfig(server));
    const data = await sftp.get(shopPath);
    res.json(JSON.parse(data.toString('utf8')));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    sftp.end();
  }
});

/**
 * Save shop (with backup)
 */
app.post('/api/servers/:serverId/shops/:shopId', async (req, res) => {
  const server = getServer(req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const sftp = new SftpClient();
  const shopPath = getShopPath(server, req.params.shopId);
  const backupPath = getBackupPath(shopPath);

  try {
    await sftp.connect(getSftpConfig(server));

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

/**
 * CREATE shop
 */
app.post('/api/servers/:serverId/shops', async (req, res) => {
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
    await sftp.connect(getSftpConfig(server));

    // Fail if file exists
    try {
      await sftp.get(shopPath);
      return res.status(409).json({ error: 'Shop already exists' });
    } catch {
      // Expected if not found
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

/**
 * DELETE shop (with backup)
 */
app.delete('/api/servers/:serverId/shops/:shopId', async (req, res) => {
  const server = getServer(req.params.serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const sftp = new SftpClient();
  const shopPath = getShopPath(server, req.params.shopId);
  const backupPath = getBackupPath(shopPath);

  try {
    await sftp.connect(getSftpConfig(server));

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
