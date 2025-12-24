/**
 * Load environment variables from .env
 * This MUST be the first line.
 */
require('dotenv').config();

const express = require('express');
const SftpClient = require('ssh2-sftp-client');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Allow JSON request bodies
 */
app.use(express.json());

/**
 * SFTP configuration
 * Values are provided via .env
 */
const SFTP_CONFIG = {
  host: process.env.SFTP_HOST,
  port: Number(process.env.SFTP_PORT || 22),
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD
};

/**
 * Remote test shop file
 * This is intentionally ONE safe test file
 */
const REMOTE_SHOP_FILE = process.env.SFTP_TEST_FILE;

/**
 * Root endpoint (sanity check)
 */
app.get('/', (req, res) => {
  res.send('Shop Dashboard is running');
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * READ shop JSON from SFTP
 * Safe, read-only operation
 */
app.get('/api/sftp-test', async (req, res) => {
  const sftp = new SftpClient();

  try {
    await sftp.connect(SFTP_CONFIG);

    const data = await sftp.get(REMOTE_SHOP_FILE);
    const json = JSON.parse(data.toString('utf8'));

    res.json(json);
  } catch (err) {
    res.status(500).json({
      error: 'SFTP read failed',
      message: err.message
    });
  } finally {
    sftp.end();
  }
});

/**
 * WRITE shop JSON back to SFTP
 * This overwrites ONLY the test file
 */
app.post('/api/sftp-test', async (req, res) => {
  const sftp = new SftpClient();

  try {
    const newJson = JSON.stringify(req.body, null, 2);

    await sftp.connect(SFTP_CONFIG);
    await sftp.put(Buffer.from(newJson, 'utf8'), REMOTE_SHOP_FILE);

    res.json({ status: 'saved_to_sftp' });
  } catch (err) {
    res.status(500).json({
      error: 'SFTP write failed',
      message: err.message
    });
  } finally {
    sftp.end();
  }
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
