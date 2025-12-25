import { state, clone, pagesOf, gridMap } from './state.js';
import { renderPages, renderGrid } from './renderGrid.js';
import { renderEditor } from './renderEditor.js';
import {
  fetchServers,
  fetchShops,
  fetchCurrencies,
  fetchShop,
  saveShop,
  createShop,
  deleteShop,
  restoreShop,
  fetchBackups,
  restoreBackup
} from './api.js';

const $ = id => document.getElementById(id);
const SHOP_CLIPBOARD_KEY = 'shop_entry_clipboard';
const stateFlags = { dirty: false };
let entryClipboard = null;

function setStatus(message) {
  $('status').textContent = message;
}

function setDirty(dirty) {
  stateFlags.dirty = dirty;
  const badge = $('unsavedBadge');
  if (badge) badge.style.display = dirty ? '' : 'none';
}

function buildSaveJson() {
  const out = clone(state.shopJson);
  out.title = $('shopTitle').value;
  out.entries = {};

  for (const [id, m] of state.models) {
    const e = { ...m.raw };
    e.item = m.item;
    e.slot = m.slot;
    e.page = m.pages;

    if (m.buy) e.buy = m.buy;
    else delete e.buy;

    if (m.sell) e.sell = m.sell;
    else delete e.sell;

    const loreLines = (m.displayLore || []).filter(l => l.trim() !== '');
    const hasDisplay =
      (m.displayName && m.displayName.trim() !== '') ||
      loreLines.length ||
      (m.displayItem && m.displayItem.trim() !== '');
    if (hasDisplay) {
      e.display = {};
      if (m.displayItem && m.displayItem.trim() !== '') {
        e.display.item = m.displayItem.trim();
      }
      if (m.displayName && m.displayName.trim() !== '') {
        e.display.name = m.displayName.trim();
      }
      if (loreLines.length) {
        e.display.lore = loreLines;
      }
    } else {
      delete e.display;
    }

    out.entries[id] = e;
  }

  return out;
}

function addPage() {
  const pages = pagesOf();
  state.page = Math.max(...pages) + 1;
  state.slot = null;
  state.entryId = null;
  setDirty(true);
  render();
}

function collectSinglePrice(priceInputId, currencySelectId) {
  const priceVal = $(priceInputId).value;
  const select = $(currencySelectId);
  const currency = select?.value?.trim();
  const selectedOpt = select?.options[select.selectedIndex];
  const economy = selectedOpt?.dataset.economy?.trim() || '';

  if (priceVal === '' || Number(priceVal) === 0) return null;
  if (!economy || !currency) return null;

  return {
    price: Number(priceVal),
    economy,
    currency
  };
}

function computeConflicts(map) {
  return map
    .map((ids, idx) => ({ ids, idx }))
    .filter(x => x.ids.length > 1);
}

function renderConflicts(map) {
  const el = $('conflictList');
  if (!el) return;
  const conflicts = computeConflicts(map);
  if (!conflicts.length) {
    el.textContent = 'No slot conflicts.';
    return;
  }
  el.innerHTML = 'Conflicts: ';
  conflicts.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'conflictLink';
    btn.textContent = `Slot #${c.idx} (${c.ids.length})`;
    btn.onclick = () => {
      state.slot = c.idx;
      state.entryId = c.ids[0] || null;
      render();
    };
    el.appendChild(btn);
  });
}

function renderPageStats(map) {
  const stats = $('pageStats');
  if (!stats) return;
  const filled = map.filter(ids => ids.length).length;
  const conflicts = map.filter(ids => ids.length > 1).length;
  const empty = map.length - filled;
  stats.textContent = `Filled: ${filled} • Empty: ${empty} • Conflicts: ${conflicts}`;
}

function getFilterTerm() {
  return ($('slotFilter').value || '').trim().toLowerCase();
}

function matchesFilter(entry, term) {
  if (!term) return true;
  return (
    entry.id.toLowerCase().includes(term) ||
    (entry.item || '').toLowerCase().includes(term)
  );
}

function getMatchSet(map) {
  const term = getFilterTerm();
  if (!term) return new Set();
  const set = new Set();
  map.forEach(ids => {
    ids.forEach(id => {
      const m = state.models.get(id);
      if (m && matchesFilter(m, term)) set.add(id);
    });
  });
  return set;
}

function render() {
  const pages = pagesOf();
  renderPages(
    state,
    pages,
    pg => {
      state.page = pg;
      state.slot = null;
      state.entryId = null;
      render();
    },
    addPage
  );

  const map = gridMap(state.page);
  const matchSet = getMatchSet(map);
  renderGrid(
    state,
    map,
    ({ slot, entryId }) => {
      state.slot = slot;
      state.entryId = entryId;
      render();
    },
    ({ entryId, targetSlot }) => {
      const model = state.models.get(entryId);
      if (!model) return;
      model.slot = targetSlot;
      state.slot = targetSlot;
      state.entryId = entryId;
      setDirty(true);
      render();
    },
    matchSet
  );

  renderPageStats(map);
  renderConflicts(map);

  renderEditor(state);
  $('rawJson').value = state.shopJson
    ? JSON.stringify(buildSaveJson(), null, 2)
    : '';
}

async function hydrateServers() {
  state.servers = await fetchServers();
  const select = $('serverSelect');
  select.innerHTML = '';

  state.servers.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name || s.id;
    select.appendChild(o);
  });

  state.serverId = select.value;
}

async function hydrateShops() {
  if (!state.serverId) return;

  state.shops = await fetchShops(state.serverId);
  const select = $('shopSelect');
  select.innerHTML = '';

  state.shops.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.id;
    select.appendChild(o);
  });

  state.shopId = select.value;
}

async function hydrateBackups() {
  const backupSelect = $('backupSelect');
  backupSelect.innerHTML = '';

  if (!state.serverId || !state.shopId) return;

  const backups = await fetchBackups(state.serverId, state.shopId);
  backups.forEach(b => {
    const o = document.createElement('option');
    o.value = b.name;
    const date = new Date(b.modifyTime);
    o.textContent = `${b.name} (${date.toLocaleString()})`;
    backupSelect.appendChild(o);
  });
}
async function hydrateCurrencies() {
  state.currencies = await fetchCurrencies();
}

async function loadCurrentShop() {
  state.shopId = $('shopSelect').value;
  state.shopJson = await fetchShop(state.serverId, state.shopId);

  $('shopTitle').value = state.shopJson.title || '';

  state.models.clear();
  Object.entries(state.shopJson.entries || {}).forEach(([id, e]) => {
    state.models.set(id, {
      id,
      item: e.item || '',
      slot: e.slot,
      pages: e.page || [1],
      displayName: e.display?.name || '',
      displayItem: e.display?.item || '',
      displayLore: e.display?.lore || [],
      buy: Array.isArray(e.buy)
        ? clone(e.buy[0] || null)
        : e.buy
          ? clone(e.buy)
          : null,
      sell: Array.isArray(e.sell)
        ? clone(e.sell[0] || null)
        : e.sell
          ? clone(e.sell)
          : null,
      raw: clone(e)
    });
  });

  state.page = pagesOf()[0] || 1;
  state.slot = null;
  state.entryId = null;
  setDirty(false);
  render();
}

$('serverSelect').onchange = async () => {
  state.serverId = $('serverSelect').value;
  await hydrateShops();
};

$('loadBtn').onclick = loadCurrentShop;

$('saveBtn').onclick = async () => {
  if (!state.shopId) return;

  const res = await saveShop(state.serverId, state.shopId, buildSaveJson());
  if (!res.ok) {
    setStatus('Save failed.');
    return;
  }
  setDirty(false);
  setStatus('Saved.');
};

$('applyBtn').onclick = () => {
  const id = $('entryId').value.trim();
  if (!id) return alert('Entry ID required');

  const m = state.models.get(state.entryId) || {
    raw: { type: 'ITEM' },
    pages: [state.page],
    buy: null,
    sell: null
  };

  m.id = id;
  m.item = $('itemId').value;
  m.displayName = $('displayName').value;
  m.displayItem = $('displayItem').value;
  m.displayLore = $('displayLore').value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length);
  m.slot = state.slot;
  m.pages = m.pages?.length ? m.pages : [state.page];

  m.buy = collectSinglePrice('buyPrice', 'buyCurrency');
  m.sell = collectSinglePrice('sellPrice', 'sellCurrency');

  state.models.delete(state.entryId);
  state.models.set(id, m);
  state.entryId = id;
  setDirty(true);
  render();
};

$('deleteEntryBtn').onclick = () => {
  if (!state.entryId) return;
  if (confirm('Delete entry from this shop?')) {
    state.models.delete(state.entryId);
    state.entryId = null;
    state.slot = null;
    setDirty(true);
    render();
  }
};

$('duplicateEntryBtn').onclick = () => {
  if (!state.entryId) return;
  const original = state.models.get(state.entryId);
  if (!original) return;

  const newId = prompt('New entry ID for duplicate:', `${original.id}_copy`);
  if (!newId) return;
  const targetSlot = Number(
    prompt('Target slot (0-53):', state.slot != null ? state.slot : 0)
  );
  if (Number.isNaN(targetSlot) || targetSlot < 0 || targetSlot > 53) return;

  const dup = clone(original);
  dup.id = newId;
  dup.slot = targetSlot;
  dup.pages = dup.pages?.length ? dup.pages : [state.page];

  state.models.set(newId, dup);
  state.entryId = newId;
  state.slot = targetSlot;
  setDirty(true);
  render();
};

$('copyEntryBtn').onclick = () => {
  if (!state.entryId) return;
  const entry = state.models.get(state.entryId);
  if (!entry) return;
  entryClipboard = clone(entry);
  localStorage.setItem(SHOP_CLIPBOARD_KEY, JSON.stringify(entryClipboard));
  setStatus(`Copied ${entry.id}`);
};

$('pasteEntryBtn').onclick = () => {
  const stored =
    entryClipboard ||
    (() => {
      const v = localStorage.getItem(SHOP_CLIPBOARD_KEY);
      if (!v) return null;
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    })();
  if (!stored) return alert('Clipboard is empty');
  if (state.slot == null) return alert('Select a slot first');

  const newId = prompt('Entry ID for paste:', stored.id || '');
  if (!newId) return;

  const model = clone(stored);
  model.id = newId;
  model.slot = state.slot;
  model.pages = model.pages?.length ? model.pages : [state.page];
  state.models.set(newId, model);
  state.entryId = newId;
  setDirty(true);
  render();
};

$('createShopBtn').onclick = async () => {
  const shopId = prompt('New shop ID (no .json extension):');
  if (!shopId) return;
  const title = prompt('Shop title (optional):') || undefined;

  const res = await createShop(state.serverId, shopId, title);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || 'Create shop failed');
    return;
  }

  await hydrateShops();
  $('shopSelect').value = shopId;
  await loadCurrentShop();
  setStatus('Shop created.');
};

$('deleteShopBtn').onclick = async () => {
  const shopId = $('shopSelect').value;
  if (!shopId) return;
  if (!confirm(`Delete shop "${shopId}"? A backup will be kept on the server.`)) {
    return;
  }

  const res = await deleteShop(state.serverId, shopId);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || 'Delete shop failed');
    return;
  }

  await hydrateShops();
  state.shopJson = null;
  state.models.clear();
  state.slot = null;
  state.entryId = null;
  setDirty(true);
  render();
  setStatus('Shop deleted.');
};

$('refreshBackupsBtn').onclick = async () => {
  await hydrateBackups();
};

$('restoreBtn').onclick = async () => {
  const shopId = $('shopSelect').value;
  if (!shopId) return;

  const backupName = $('backupSelect').value;
  if (!backupName) {
    alert('Select a backup to restore');
    return;
  }

  if (!confirm(`Restore "${shopId}" from backup "${backupName}"?`)) return;

  const res = await restoreBackup(state.serverId, shopId, backupName);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || 'Restore failed');
    return;
  }

  await loadCurrentShop();
  setStatus(`Restored from ${backupName}`);
};

$('exportBtn').onclick = () => {
  const data = JSON.stringify(buildSaveJson(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.shopId || 'shop'}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const json = JSON.parse(text);
    state.shopJson = json;
    state.shopId = state.shopId || json.title || 'imported';
    $('shopTitle').value = json.title || '';
    state.models.clear();
    Object.entries(json.entries || {}).forEach(([id, e]) => {
      state.models.set(id, {
        id,
        item: e.item || '',
        slot: e.slot,
        pages: e.page || [1],
        displayName: e.display?.name || '',
        displayItem: e.display?.item || '',
        displayLore: e.display?.lore || [],
        buy: Array.isArray(e.buy)
          ? clone(e.buy[0] || null)
          : e.buy
            ? clone(e.buy)
            : null,
        sell: Array.isArray(e.sell)
          ? clone(e.sell[0] || null)
          : e.sell
            ? clone(e.sell)
            : null,
        raw: clone(e)
      });
    });

    state.page = pagesOf()[0] || 1;
    state.slot = null;
    state.entryId = null;
    setDirty(true);
    render();
    setStatus('Imported from file (not saved to server yet).');
  } catch (err) {
    alert('Invalid JSON file');
  } finally {
    e.target.value = '';
  }
};

$('slotFilter').oninput = () => render();

document.addEventListener('keydown', e => {
  const key = e.key;
  const index = state.slot ?? 0;
  const cols = 9;
  const max = 53;
  let next = index;
  if (key === 'ArrowRight') next = Math.min(max, index + 1);
  else if (key === 'ArrowLeft') next = Math.max(0, index - 1);
  else if (key === 'ArrowDown') next = Math.min(max, index + cols);
  else if (key === 'ArrowUp') next = Math.max(0, index - cols);
  else return;
  e.preventDefault();
  state.slot = next;
  state.entryId = gridMap(state.page)[next][0] || null;
  render();
});

$('buyPreset').onchange = () => {
  const v = $('buyPreset').value;
  if (v) $('buyPrice').value = v;
};
$('sellPreset').onchange = () => {
  const v = $('sellPreset').value;
  if (v) $('sellPrice').value = v;
};

(async () => {
  await hydrateServers();
  await hydrateCurrencies();
  await hydrateShops();
  await hydrateBackups();
  setDirty(false);
  setStatus('Ready.');
})();

/* ---------------- THEME TOGGLE ---------------- */
const THEME_KEY = 'theme-preference';
const themeButtons = {
  system: $('themeSystemBtn'),
  light: $('themeLightBtn'),
  dark: $('themeDarkBtn')
};

const systemMedia = window.matchMedia('(prefers-color-scheme: dark)');

function getSystemTheme() {
  return systemMedia.matches ? 'dark' : 'light';
}

function setActiveThemeButton(mode) {
  Object.entries(themeButtons).forEach(([key, btn]) => {
    if (!btn) return;
    btn.classList.toggle('btn--active', key === mode);
  });
}

function applyTheme(mode, persist = true) {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.setAttribute('data-theme', resolved);
  setActiveThemeButton(mode);
  if (persist) localStorage.setItem(THEME_KEY, mode);
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(stored, false);

  if (themeButtons.system) {
    themeButtons.system.onclick = () => applyTheme('system');
  }
  if (themeButtons.light) {
    themeButtons.light.onclick = () => applyTheme('light');
  }
  if (themeButtons.dark) {
    themeButtons.dark.onclick = () => applyTheme('dark');
  }

  systemMedia.onchange = () => {
    const current = localStorage.getItem(THEME_KEY) || 'system';
    if (current === 'system') applyTheme('system', false);
  };
}

initTheme();
