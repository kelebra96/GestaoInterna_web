export type Status = 'pending' | 'batched' | 'closed';

export const names = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Giovana', 'Henrique', 'Isabela', 'João'];
export const stores = ['Loja Centro', 'Loja Norte', 'Loja Sul', 'Loja Leste', 'Loja Oeste'];
export const statuses: Status[] = ['pending', 'batched', 'closed'];

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function makeId(i: number) {
  return `SOL-${i.toString(36).toUpperCase()}-${randomInt(1000, 9999)}`;
}

export function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function generateDeterministic(id: string) {
  const h = hashString(id);
  const status = statuses[h % statuses.length];
  const name = names[h % names.length];
  const store = stores[(h >> 3) % stores.length];
  const daysAgo = (h % 30);
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  const items = (h % 12) + 1;
  const total = Number((((h % 1200) + 50) + ((h % 100) / 100)).toFixed(2));
  return {
    id,
    status,
    createdAt: created.toISOString(),
    userName: name,
    storeName: store,
    items,
    total,
  };
}

export function generateMock(count = 60) {
  const today = new Date();
  const out = Array.from({ length: count }).map((_, i) => {
    const id = makeId(i + 1);
    const daysAgo = randomInt(0, 45);
    const created = new Date(today);
    created.setDate(today.getDate() - daysAgo);
    const status = statuses[randomInt(0, statuses.length - 1)];
    return {
      id,
      status,
      createdAt: created.toISOString(),
      userName: names[randomInt(0, names.length - 1)],
      storeName: stores[randomInt(0, stores.length - 1)],
      items: randomInt(1, 12),
      total: Number((Math.random() * 1200 + 50).toFixed(2)),
    };
  });
  return out;
}
