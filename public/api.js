const jsonHeaders = { 'Content-Type': 'application/json' };

export async function fetchServers() {
  const r = await fetch('/api/servers');
  return r.json();
}

export async function fetchShops(serverId) {
  const r = await fetch(`/api/servers/${serverId}/shops`);
  return r.json();
}

export async function fetchCurrencies() {
  const r = await fetch('/api/currencies');
  return r.json();
}

export async function fetchShop(serverId, shopId) {
  const r = await fetch(`/api/servers/${serverId}/shops/${shopId}`);
  return r.json();
}

export async function saveShop(serverId, shopId, body) {
  return fetch(`/api/servers/${serverId}/shops/${shopId}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body)
  });
}

export async function createShop(serverId, shopId, title) {
  return fetch(`/api/servers/${serverId}/shops`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ shopId, title })
  });
}

export async function deleteShop(serverId, shopId) {
  return fetch(`/api/servers/${serverId}/shops/${shopId}`, {
    method: 'DELETE'
  });
}

export async function restoreShop(serverId, shopId) {
  return fetch(`/api/servers/${serverId}/shops/${shopId}/restore`, {
    method: 'POST'
  });
}

export async function fetchBackups(serverId, shopId) {
  const r = await fetch(`/api/servers/${serverId}/shops/${shopId}/backups`);
  return r.json();
}

export async function restoreBackup(serverId, shopId, backupName) {
  return fetch(
    `/api/servers/${serverId}/shops/${shopId}/restore/${encodeURIComponent(backupName)}`,
    { method: 'POST' }
  );
}
