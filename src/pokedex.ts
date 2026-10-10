export const POKEDEX_KEY = 'pokequest.pokedex';
export const DEX_SIZE = 151;

export function loadCaught(storage?: Storage): number[] {
  if (!storage) {
    return [];
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(POKEDEX_KEY);
  } catch {
    return [];
  }

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const validIds = parsed.filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= DEX_SIZE
    );

    return Array.from(new Set(validIds)).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function addCaught(caught: number[], id: number): number[] {
  if (!Number.isInteger(id) || id < 1 || id > DEX_SIZE) {
    return [...caught].sort((a, b) => a - b);
  }

  const set = new Set(caught);
  set.add(id);
  return Array.from(set).sort((a, b) => a - b);
}

export function saveCaught(storage: Storage | undefined, caught: number[]): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(POKEDEX_KEY, JSON.stringify(caught));
  } catch {
    // Swallow exceptions (blocked or full storage)
  }
}

