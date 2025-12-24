const $ = id => document.getElementById(id);

const state = {
  servers: [],
  shops: [],
  serverId: null,
  shopId: null,
  shopJson: null,
  models: new Map(),
  page: 1,
  slot: null,
  entryId: null
};

const clone = o => JSON.parse(JSON.stringify(o));

/* ---------------- PAGES ---------------- */

function pagesOf() {
  const set = new Set([1]);
  for (const m of state.models.values()) {
    m.pages.forEach(p => set.add(p));
  }
  return [...set].sort((a,b)=>a-b);
}

function addPage() {
  const pages = pagesOf();
  const next = pages.length ? Math.max(...pages) + 1 : 1;
  state.page = next;
  render();
}

/* ---------------- GRID ---------------- */

function gridMap(page) {
  const g = Array.from({ length: 54 }, () => []);
  for (const [id, m] of state.models) {
    if (m.pages.includes(page)) g[m.slot].push(id);
  }
  return g;
}

/* ---------------- SAVE ---------------- */

function buildSaveJson() {
  const out = clone(state.shopJson);
  out.title = $('shopTitle').value;
  out.entries = {};

  for (const [id, m] of state.models) {
    const e = m.raw;
    e.item = m.item;
    e.slot = m.slot;
    e.page = m.pages;

    if (m.buy != null) e.buy = { price: m.buy };
    else delete e.buy;

    if (m.sell != null) e.sell = { price: m.sell };
    else delete e.sell;

    out.entries[id] = e;
  }

  return out;
}

/* ---------------- RENDER ---------------- */

function render() {
  renderPages();
  renderGrid();
  renderEditor();
  $('rawJson').value = state.shopJson
    ? JSON.stringify(buildSaveJson(), null, 2)
    : '';
}

function renderPages() {
  const p = $('pages');
  p.innerHTML = '';

  pagesOf().forEach(pg => {
    const b = document.createElement('button');
    b.className = 'pageBtn' + (pg === state.page ? ' active' : '');
    b.textContent = `Page ${pg}`;
    b.onclick = () => {
      state.page = pg;
      state.slot = null;
      state.entryId = null;
      render();
    };
    p.appendChild(b);
  });

  const add = document.createElement('button');
  add.className = 'pageBtn';
  add.textContent = '+ Add Page';
  add.onclick = addPage;
  p.appendChild(add);
}

function renderGrid() {
  const g = $('grid');
  g.innerHTML = '';
  const map = gridMap(state.page);

  for (let i = 0; i < 54; i++) {
    const c = document.createElement('div');
    c.className =
      'cell' +
      (state.slot === i ? ' selected' : '') +
      (map[i].length > 1 ? ' conflict' : '');

    const entryId = map[i][0];
let iconHtml = '';
let label = '(empty)';

if (entryId) {
  const m = state.models.get(entryId);
  label = entryId;

  if (m?.item && m.item.includes(':')) {
    const itemName = m.item.split(':')[1];
    const url = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20/assets/minecraft/textures/item/${itemName}.png`;

    iconHtml = `<img class="cellIcon" src="${url}" onerror="this.style.display='none'">`;
  }
} else {
  c.classList.add('empty');
}

c.innerHTML = `
  <div class="slotLabel">Slot ${i}</div>
  <div class="cellContent">
    ${iconHtml}
    <div class="cellMain">${label}</div>
  </div>
  <div class="cellSub">${map[i].length > 1 ? 'CONFLICT' : ''}</div>
`;


    c.onclick = () => {
      state.slot = i;
      state.entryId = map[i][0] || null;
      render();
    };

    g.appendChild(c);
  }
}

function renderEditor() {
  if (state.slot == null) {
    $('editorEmpty').style.display = '';
    $('editorPanel').style.display = 'none';
    return;
  }

  $('editorEmpty').style.display = 'none';
  $('editorPanel').style.display = '';
  $('slotIndex').value = state.slot;

  if (!state.entryId) {
    $('entryId').value = '';
    $('itemId').value = '';
    $('buyPrice').value = '';
    $('sellPrice').value = '';
    return;
  }

  const m = state.models.get(state.entryId);
  $('entryId').value = m.id;
  $('itemId').value = m.item;
  $('buyPrice').value = m.buy ?? '';
  $('sellPrice').value = m.sell ?? '';
}

/* ---------------- API ---------------- */

async function loadServers() {
  const r = await fetch('/api/servers');
  state.servers = await r.json();
  $('serverSelect').innerHTML = '';

  state.servers.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name || s.id;
    $('serverSelect').appendChild(o);
  });

  state.serverId = $('serverSelect').value;
}

async function loadShops() {
  const r = await fetch(`/api/servers/${state.serverId}/shops`);
  state.shops = await r.json();
  $('shopSelect').innerHTML = '';

  state.shops.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.id;
    $('shopSelect').appendChild(o);
  });

  state.shopId = $('shopSelect').value;
}

async function loadShop() {
  state.shopId = $('shopSelect').value;
  const r = await fetch(`/api/servers/${state.serverId}/shops/${state.shopId}`);
  state.shopJson = await r.json();

  $('shopTitle').value = state.shopJson.title || '';

  state.models.clear();
  Object.entries(state.shopJson.entries || {}).forEach(([id, e]) => {
    state.models.set(id, {
      id,
      item: e.item || '',
      slot: e.slot,
      pages: e.page || [1],
      buy: e.buy?.price ?? null,
      sell: e.sell?.price ?? null,
      raw: clone(e)
    });
  });

  state.page = pagesOf()[0] || 1;
  state.slot = null;
  state.entryId = null;
  render();
}

/* ---------------- EVENTS ---------------- */

$('serverSelect').onchange = async () => {
  state.serverId = $('serverSelect').value;
  await loadShops();
};

$('loadBtn').onclick = loadShop;

$('saveBtn').onclick = async () => {
  await fetch(`/api/servers/${state.serverId}/shops/${state.shopId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSaveJson())
  });
  $('status').textContent = 'Saved.';
};

$('applyBtn').onclick = () => {
  const id = $('entryId').value.trim();
  if (!id) return alert('Entry ID required');

  const m = state.models.get(state.entryId) || {
    raw: { type: 'ITEM' },
    pages: [state.page]
  };

  m.id = id;
  m.item = $('itemId').value;
  m.slot = state.slot;
  m.pages = m.pages?.length ? m.pages : [state.page];
  m.buy = $('buyPrice').value === '' ? null : +$('buyPrice').value;
  m.sell = $('sellPrice').value === '' ? null : +$('sellPrice').value;

  state.models.delete(state.entryId);
  state.models.set(id, m);
  state.entryId = id;
  render();
};

$('deleteEntryBtn').onclick = () => {
  if (!state.entryId) return;
  if (confirm('Delete entry from this shop?')) {
    state.models.delete(state.entryId);
    state.entryId = null;
    state.slot = null;
    render();
  }
};

/* ---------------- INIT ---------------- */

(async () => {
  await loadServers();
  await loadShops();
  $('status').textContent = 'Ready.';
})();
