require('dotenv').config();

const express = require('express');
const { GLOBAL_SFTP, servers, currencies } = require('./server/config');
const { buildRouter } = require('./server/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Shop Dashboard is running');
});

app.use(
  '/api',
  buildRouter({ servers, currencies, credentials: GLOBAL_SFTP })
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
