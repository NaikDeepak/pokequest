// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initApp } from './main.ts';
import type { Pokemon } from './pokeapi.ts';
import { PokeApiError } from './pokeapi.ts';

describe('main quiz UI', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  const mockPokemons: Record<number, Pokemon> = {
    1: { id: 1, name: 'bulbasaur', sprite: 'https://img.test/1.png', types: ['grass'] },
    4: { id: 4, name: 'charmander', sprite: 'https://img.test/4.png', types: ['fire'] },
    7: { id: 7, name: 'squirtle', sprite: 'https://img.test/7.png', types: ['water'] },
    25: { id: 25, name: 'pikachu', sprite: 'https://img.test/25.png', types: ['electric'] },
    122: { id: 122, name: 'mr-mime', sprite: 'https://img.test/122.png', types: ['psychic'] },
  };

  function createMockApi(overrides: Partial<Record<number, Pokemon>> = {}) {
    const data = { ...mockPokemons, ...overrides };
    return {
      getPokemon: vi.fn(async (id: number) => {
        const p = data[id];
        if (!p) throw new PokeApiError(`Pokemon ${id} not found`);
        return p;
      }),
    };
  }

  // A fixed RNG that deterministically selects IDs 1, 4, 7, 25 and answerId 25 (index 3)
  function createFixedRng() {
    const sequence = [
      0 / 151,  // id 1
      3 / 151,  // id 4
      6 / 151,  // id 7
      24 / 151, // id 25
      0.99,     // answer index: Math.floor(0.99 * 4) = 3 -> id 25
    ];
    let i = 0;
    return () => sequence[i++ % sequence.length];
  }

  it('8. after load: an <img> with class silhouette and 4 option buttons with formatted names', async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const img = container.querySelector<HTMLImageElement>('img');
    expect(img).not.toBeNull();
    expect(img?.classList.contains('silhouette')).toBe(true);
    expect(img?.src).toBe('https://img.test/25.png');

    const optionButtons = container.querySelectorAll<HTMLButtonElement>('.option-btn');
    expect(optionButtons).toHaveLength(4);
    const names = Array.from(optionButtons).map((btn) => btn.textContent?.trim());
    expect(names).toEqual(['Bulbasaur', 'Charmander', 'Squirtle', 'Pikachu']);
  });

  it('9. clicking the right button: image loses silhouette, a status shows "Correct", score shows 1, buttons disabled, "Next" visible', async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const img = container.querySelector<HTMLImageElement>('img')!;
    const optionButtons = container.querySelectorAll<HTMLButtonElement>('.option-btn');
    const pikachuBtn = Array.from(optionButtons).find((b) => b.textContent?.trim() === 'Pikachu')!;
    const nextBtn = container.querySelector<HTMLButtonElement>('.next-btn')!;
    const statusEl = container.querySelector<HTMLElement>('.status')!;
    const scoreEl = container.querySelector<HTMLElement>('.score-val')!;

    expect(nextBtn.hidden || getComputedStyle(nextBtn).display === 'none').toBe(true);

    pikachuBtn.click();

    expect(img.classList.contains('silhouette')).toBe(false);
    expect(statusEl.textContent).toContain('Correct');
    expect(scoreEl.textContent).toBe('1');

    for (const btn of optionButtons) {
      expect(btn.disabled).toBe(true);
    }

    expect(nextBtn.hidden).toBe(false);
    expect(getComputedStyle(nextBtn).display).not.toBe('none');
  });

  it('10. clicking a wrong button: status says "It\'s <Right Name>!", the right button gets class correct, the clicked one wrong, streak 0', async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const optionButtons = container.querySelectorAll<HTMLButtonElement>('.option-btn');
    const charmanderBtn = Array.from(optionButtons).find((b) => b.textContent?.trim() === 'Charmander')!;
    const pikachuBtn = Array.from(optionButtons).find((b) => b.textContent?.trim() === 'Pikachu')!;
    const statusEl = container.querySelector<HTMLElement>('.status')!;
    const streakEl = container.querySelector<HTMLElement>('.streak-val')!;
    const img = container.querySelector<HTMLImageElement>('img')!;

    charmanderBtn.click();

    expect(statusEl.textContent).toBe("It's Pikachu!");
    expect(charmanderBtn.classList.contains('wrong')).toBe(true);
    expect(pikachuBtn.classList.contains('correct')).toBe(true);
    expect(streakEl.textContent).toBe('0');
    expect(img.classList.contains('silhouette')).toBe(false);
  });

  it('11. best score is read from and written to localStorage["pokequest.best"]', async () => {
    localStorage.setItem('pokequest.best', '5');

    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const bestEl = container.querySelector<HTMLElement>('.best-val')!;
    expect(bestEl.textContent).toBe('5');

    // Reset best to 0 in storage to test write when streak increases
    localStorage.setItem('pokequest.best', '0');
    const appWithZeroBest = document.createElement('div');
    document.body.appendChild(appWithZeroBest);
    await initApp(appWithZeroBest, { api, rng });

    const zeroBestEl = appWithZeroBest.querySelector<HTMLElement>('.best-val')!;
    expect(zeroBestEl.textContent).toBe('0');

    const pikachuBtn = Array.from(appWithZeroBest.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Pikachu'
    )!;
    pikachuBtn.click();

    expect(zeroBestEl.textContent).toBe('1');
    expect(localStorage.getItem('pokequest.best')).toBe('1');
  });

  it('12. edge: api rejects -> an error message and a "Try again" button that retries', async () => {
    let shouldFail = true;
    const api = {
      getPokemon: vi.fn(async (id: number) => {
        if (shouldFail) {
          throw new PokeApiError('Network connection failed');
        }
        return mockPokemons[id] ?? { id, name: 'pikachu', sprite: 'https://img.test/25.png', types: ['electric'] };
      }),
    };
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const errorEl = container.querySelector<HTMLElement>('.error-message');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Network connection failed');

    const retryBtn = container.querySelector<HTMLButtonElement>('.retry-btn');
    expect(retryBtn).not.toBeNull();

    shouldFail = false;
    retryBtn!.click();

    // Allow promise resolution
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(container.querySelector('.error-message')).toBeNull();
    const img = container.querySelector<HTMLImageElement>('img');
    expect(img).not.toBeNull();
    expect(img?.classList.contains('silhouette')).toBe(true);
  });
});
