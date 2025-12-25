const $ = id => document.getElementById(id);

function populateCurrencySelect(selectEl, currencies, value) {
  selectEl.innerHTML = '';
  currencies.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name || c.id;
    o.dataset.economy = c.economy;
    selectEl.appendChild(o);
  });

  const matched = currencies.find(c => c.id === value);
  if (!matched && value) {
    const custom = document.createElement('option');
    custom.value = value;
    custom.textContent = `${value} (custom)`;
    custom.dataset.economy = '';
    selectEl.appendChild(custom);
  }

  if (value) selectEl.value = value;
}

export function renderEditor(state) {
  const currencies = state.currencies || [];

  const slotDisplay = $('slotIndexDisplay');
  if (slotDisplay) slotDisplay.textContent = state.slot ?? '—';

  if (state.slot == null) {
    $('editorEmpty').style.display = '';
    $('editorPanel').style.display = 'none';
    return;
  }

  $('editorEmpty').style.display = 'none';
  $('editorPanel').style.display = '';
  if (slotDisplay) slotDisplay.textContent = state.slot;

  const buyCurrencySelect = $('buyCurrency');
  const sellCurrencySelect = $('sellCurrency');

  populateCurrencySelect(buyCurrencySelect, currencies, null);
  populateCurrencySelect(sellCurrencySelect, currencies, null);

  if (!state.entryId) {
    $('entryId').value = '';
    $('itemId').value = '';
    $('displayName').value = '';
    $('displayItem').value = '';
    $('displayLore').value = '';
    $('buyPrice').value = '';
    $('sellPrice').value = '';
    return;
  }

  const m = state.models.get(state.entryId);
  $('entryId').value = m.id;
  $('itemId').value = m.item;
  $('displayName').value = m.displayName || '';
  $('displayItem').value = m.displayItem || '';
  $('displayLore').value = (m.displayLore || []).join('\n');

  $('buyPrice').value = m.buy?.price ?? '';
  $('sellPrice').value = m.sell?.price ?? '';

  populateCurrencySelect(buyCurrencySelect, currencies, m.buy?.currency);
  populateCurrencySelect(sellCurrencySelect, currencies, m.sell?.currency);
}
