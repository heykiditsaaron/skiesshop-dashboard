const $ = id => document.getElementById(id);

export function renderPages(state, pages, onSelectPage, onAddPage) {
  const p = $('pages');
  p.innerHTML = '';

  pages.forEach(pg => {
    const b = document.createElement('button');
    b.className = 'pageBtn' + (pg === state.page ? ' active' : '');
    b.textContent = `Page ${pg}`;
    b.onclick = () => onSelectPage(pg);
    p.appendChild(b);
  });

  const add = document.createElement('button');
  add.className = 'pageBtn';
  add.textContent = '+ Add Page';
  add.onclick = onAddPage;
  p.appendChild(add);
}

export function renderGrid(state, map, onSelectSlot, onMoveEntry, matchSet = new Set()) {
  const g = $('grid');
  g.innerHTML = '';

  for (let i = 0; i < 54; i++) {
    const c = document.createElement('div');
    c.className =
      'cell' +
      (state.slot === i ? ' selected' : '') +
      (map[i].length > 1 ? ' conflict' : '');

    const entryId = map[i][0];
    const entries = map[i]
      .map(id => state.models.get(id))
      .filter(Boolean);
    const primary = entries[0];

    if (!entryId) c.classList.add('empty');

    const slotLabel = `#${i}`;
    const entryLabel = entryId || 'Empty';

    const shortCurrency = cur => (cur || '').split(':').pop() || '';
    const buyText = primary?.buy
      ? `Buy ${primary.buy.price} ${shortCurrency(primary.buy.currency)}`
      : '';
    const sellText = primary?.sell
      ? `Sell ${primary.sell.price} ${shortCurrency(primary.sell.currency)}`
      : '';
    const summary = [buyText, sellText].filter(Boolean).join(' / ');

    const itemInfo = primary?.item ? `Item: ${primary.item}` : '';
    const title = [entryLabel, itemInfo, buyText, sellText]
      .filter(Boolean)
      .join('\n');
    c.title = title || 'Empty slot';

    const conflictBadge =
      map[i].length > 1
        ? `<span class="badge badge--conflict">${map[i].length}x</span>`
        : '';

    c.classList.toggle('match', matchSet.has(entryId));

    c.innerHTML = `
      <div class="cellContent">
        <div class="cellMeta">
          <span class="slotIndex">${slotLabel}</span>
          ${conflictBadge}
        </div>
        <div class="cellMain">${entryLabel}</div>
        <div class="cellSub">${summary || (entryId ? '' : 'No prices')}</div>
      </div>
    `;

    if (entryId && onMoveEntry) {
      c.draggable = true;
      c.dataset.entryId = entryId;
      c.ondragstart = e => {
        e.dataTransfer.setData('text/plain', entryId);
        c.classList.add('dragging');
      };
      c.ondragend = () => c.classList.remove('dragging');
    }

    c.ondragover = e => {
      e.preventDefault();
      c.classList.add('drag-over');
    };

    c.ondragleave = () => c.classList.remove('drag-over');

    c.ondrop = e => {
      e.preventDefault();
      c.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && onMoveEntry) {
        onMoveEntry({ entryId: draggedId, targetSlot: i });
      }
    };

    c.onclick = () => onSelectSlot({ slot: i, entryId: entryId || null });
    g.appendChild(c);
  }
}
