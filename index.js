require('dotenv').config();

const express = require('express');
const SftpClient = require('ssh2-sftp-client');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * Global SFTP credentials (shared by all servers)
 */
const GLOBAL_SFTP = {
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD
};

/**
 * Load server profiles from environment variables.
 * Currently supports SERVER_1 only.
 */
function loadServers() {
  return [
    {
      id: process.env.SERVER_1_ID,
      name: process.env.SERVER_1_NAME,
      host: process.env.SERVER_1_HOST,
      port: Number(process.env.SERVER_1_PORT),
      basePath: process.env.SERVER_1_BASE_PATH
    }
  ];
}

const servers = loadServers();

/**
 * Helper: find server by ID
 */
function getServer(serverId) {
  return servers.find(s => s.id === serverId);
}

/**
 * Helper: build full shop file path
 */
function getShopPath(server, shopId) {
  return path.posix.join(server.basePath, `${shopId}.json`);
}

/**
 * Helper: build SFTP config for a server
 */
function getSftpConfig(server) {
  return {
    host: server.host,
    port: server.port,
    ...GLOBAL_SFTP
  };
}

/**
 * Root sanity endpoint
 */
app.get('/', (req, res) => {
  res.send('Shop Dashboard is running');
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * List servers
 */
app.get('/api/servers', (req, res) => {
  res.json(
    servers.map(s => ({
      id: s.id,
      name: s.name
    }))
  );
});

/**
 * READ shop via SFTP
 */
app.get('/api/servers/:serverId/shops/:shopId', async (req, res) => {
  const { serverId, shopId } = req.params;
  const server = getServer(serverId);

  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  const shopPath = getShopPath(server, shopId);
  const sftp = new SftpClient();

  try {
    await sftp.connect(getSftpConfig(server));
    const data = await sftp.get(shopPath);
    res.json(JSON.parse(data.toString('utf8')));
  } catch (err) {
    res.status(500).json({
      error: 'Failed to read shop',
      message: err.message
    });
  } finally {
    sftp.end();
  }
});

/**
 * WRITE shop via SFTP
 */
app.post('/api/servers/:serverId/shops/:shopId', async (req, res) => {
  const { serverId, shopId } = req.params;
  const server = getServer(serverId);

  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  const shopPath = getShopPath(server, shopId);
  const sftp = new SftpClient();

  try {
    const newJson = JSON.stringify(req.body, null, 2);

    await sftp.connect(getSftpConfig(server));
    await sftp.put(Buffer.from(newJson, 'utf8'), shopPath);

    res.json({ status: 'saved' });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to write shop',
      message: err.message
    });
  } finally {
    sftp.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
