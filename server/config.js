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

const GLOBAL_SFTP = {
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD
};

function loadCurrenciesFromEnv() {
  const currencies = [];

  const indices = Object.keys(process.env)
    .map(k => {
      const m = k.match(/^CURRENCY_(\d+)_ID$/);
      return m ? Number(m[1]) : null;
    })
    .filter(n => n !== null)
    .sort((a, b) => a - b);

  for (const index of indices) {
    const p = `CURRENCY_${index}_`;
    const id = process.env[`${p}ID`];
    const name = process.env[`${p}NAME`];
    const economy = process.env[`${p}ECONOMY`];
    if (!id || !economy) continue;

    currencies.push({
      id,
      name: name || id,
      economy
    });
  }

  return currencies;
}

const servers = loadServersFromEnv();
const currencies = loadCurrenciesFromEnv();

module.exports = {
  GLOBAL_SFTP,
  currencies,
  loadCurrenciesFromEnv,
  loadServersFromEnv,
  servers
};
