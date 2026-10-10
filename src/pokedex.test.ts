import { describe, it, expect, vi } from 'vitest';
import { POKEDEX_KEY, DEX_SIZE, loadCaught, addCaught, saveCaught } from './pokedex.ts';

describe('pokedex', () => {
  it('16. loadCaught: no key -> []; "[25,1,25,999,0,\\"x\\",1.5]" -> [1,25]; invalid JSON "{oops" -> []; no storage -> []', () => {
    expect(DEX_SIZE).toBe(151);

    const storage = {
      getItem: vi.fn((key: string) => {
        if (key === POKEDEX_KEY) return null;
        return null;
      }),
      setItem: vi.fn(),
    } as unknown as Storage;

    expect(loadCaught(storage)).toEqual([]);
    expect(loadCaught(undefined)).toEqual([]);

    (storage.getItem as any).mockReturnValue('"[25,1,25,999,0,\\"x\\",1.5]"');
    // Note: JSON string could be array string:
    (storage.getItem as any).mockReturnValue('[25,1,25,999,0,"x",1.5]');
    expect(loadCaught(storage)).toEqual([1, 25]);

    (storage.getItem as any).mockReturnValue('{oops');
    expect(loadCaught(storage)).toEqual([]);
  });

  it('17. addCaught([25,1], 4) -> [1,4,25]; adding an id already there returns the same contents; the input array is unchanged', () => {
    const original = [25, 1];
    const originalCopy = [...original];

    const result = addCaught(original, 4);
    expect(result).toEqual([1, 4, 25]);
    expect(original).toEqual(originalCopy);

    const alreadyThere = addCaught([1, 4, 25], 4);
    expect(alreadyThere).toEqual([1, 4, 25]);

    const alreadyThere2 = addCaught([25, 1], 25);
    expect(alreadyThere2).toEqual([1, 25]);
  });

  it('18. saveCaught writes JSON.stringify of the array to pokequest.pokedex; saveCaught(undefined, ...) doesn\'t throw', () => {
    const setItem = vi.fn();
    const storage = { setItem } as unknown as Storage;

    saveCaught(storage, [1, 4, 25]);
    expect(setItem).toHaveBeenCalledWith(POKEDEX_KEY, JSON.stringify([1, 4, 25]));

    expect(() => saveCaught(undefined, [1, 4, 25])).not.toThrow();
  });

  it('loadCaught and saveCaught swallow exceptions when storage methods throw', () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError: The operation is insecure');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    } as unknown as Storage;

    expect(() => loadCaught(throwingStorage)).not.toThrow();
    expect(loadCaught(throwingStorage)).toEqual([]);
    expect(() => saveCaught(throwingStorage, [1, 4, 25])).not.toThrow();
  });
});

