export const FIXED_ECONOMY = 'IMPACTOR';
export const FIXED_CURRENCY = 'impactor:pokedollars';

export const state = {
  servers: [],
  shops: [],
  currencies: [],
  serverId: null,
  shopId: null,
  shopJson: null,
  models: new Map(),
  page: 1,
  slot: null,
  entryId: null
};

export const clone = o => JSON.parse(JSON.stringify(o));

export function pagesOf(models = state.models) {
  const set = new Set([1]);
  for (const m of models.values()) {
    m.pages.forEach(p => set.add(p));
  }
  return [...set].sort((a, b) => a - b);
}

export function gridMap(page, models = state.models) {
  const g = Array.from({ length: 54 }, () => []);
  for (const [id, m] of models) {
    if (m.pages.includes(page)) g[m.slot].push(id);
  }
  return g;
}
