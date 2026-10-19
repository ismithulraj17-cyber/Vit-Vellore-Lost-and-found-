const STOP_WORDS = new Set(['near', 'by', 'at', 'in', 'the', 'to', 'of', 'and']);

export const getMapItemFields = (item) => ({
  id: item.id,
  name: item.name ?? item.title ?? 'Unnamed item',
  category: item.category ?? 'Other',
  lat: item.lat,
  lng: item.lng,
  building: item.building ?? item.location ?? 'Campus',
  floor: item.floor?.trim() || 'Floor not provided',
  landmark: item.landmark?.trim() || '',
});

export function searchMapItems(items, query) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  const nameMatches = items.filter(item => {
    const { name, category } = getMapItemFields(item);
    return name.toLocaleLowerCase().includes(term) || category.toLocaleLowerCase().includes(term);
  });
  const locationMatches = searchLocationItems(items, term);
  return [...new Map([...nameMatches, ...locationMatches].map(item => [item.id, item])).values()];
}

export function searchLocationItems(items, query) {
  const tokens = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(token => !STOP_WORDS.has(token) && token.length > 1) ?? [];
  if (!tokens.length) return [];
  return items.filter(item => {
    const { building, floor, landmark } = getMapItemFields(item);
    const location = `${building} ${floor} ${landmark}`.toLocaleLowerCase();
    return tokens.every(token => location.includes(token));
  });
}
