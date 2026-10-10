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

  it('13. error view does not use innerHTML with error message (prevents XSS)', async () => {
    const maliciousPayload = '<img src=x onerror=alert(1)>';
    const api = {
      getPokemon: vi.fn(async () => {
        throw new Error(maliciousPayload);
      }),
    };
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const errorEl = container.querySelector<HTMLElement>('.error-message');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe(maliciousPayload);

    const errorView = container.querySelector<HTMLElement>('.error-view');
    expect(errorView).not.toBeNull();
    expect(errorView?.querySelectorAll('img')).toHaveLength(0);
  });

  it("14. after a reveal, image alt is formatted name; on a new round it goes back to \"Who's that Pokémon?\"", async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const img = container.querySelector<HTMLImageElement>('img')!;
    expect(img.alt).toBe("Who's that Pokémon?");

    const optionButtons = container.querySelectorAll<HTMLButtonElement>('.option-btn');
    const pikachuBtn = Array.from(optionButtons).find((b) => b.textContent?.trim() === 'Pikachu')!;
    pikachuBtn.click();

    expect(img.alt).toBe('Pikachu');

    const nextBtn = container.querySelector<HTMLButtonElement>('.next-btn')!;
    nextBtn.click();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(img.alt).toBe("Who's that Pokémon?");
  });

  it('19. A .dex-btn button in the score bar reads Pokédex 0/151; with storage pre-seeded [1,4] it reads Pokédex 2/151', async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });
    const dexBtn = container.querySelector<HTMLButtonElement>('.score-bar .dex-btn');
    expect(dexBtn).not.toBeNull();
    expect(dexBtn?.textContent?.trim()).toBe('Pokédex 0/151');

    localStorage.setItem('pokequest.pokedex', JSON.stringify([1, 4]));
    const container2 = document.createElement('div');
    document.body.appendChild(container2);
    await initApp(container2, { api, rng });
    const dexBtn2 = container2.querySelector<HTMLButtonElement>('.score-bar .dex-btn');
    expect(dexBtn2?.textContent?.trim()).toBe('Pokédex 2/151');
  });

  it('20. A correct answer saves the answer id to pokequest.pokedex and the button updates to Pokédex 1/151. A wrong answer saves nothing. Correctly naming an already-caught Pokémon doesn\'t count it twice.', async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });
    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    expect(dexBtn.textContent?.trim()).toBe('Pokédex 0/151');

    // Wrong answer
    const charmanderBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Charmander'
    )!;
    charmanderBtn.click();
    expect(localStorage.getItem('pokequest.pokedex')).toBeNull();
    expect(dexBtn.textContent?.trim()).toBe('Pokédex 0/151');

    // Fresh round: correct answer
    const container2 = document.createElement('div');
    document.body.appendChild(container2);
    await initApp(container2, { api, rng });
    const dexBtn2 = container2.querySelector<HTMLButtonElement>('.dex-btn')!;
    const pikachuBtn = Array.from(container2.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Pikachu'
    )!;
    pikachuBtn.click();

    expect(JSON.parse(localStorage.getItem('pokequest.pokedex') || '[]')).toEqual([25]);
    expect(dexBtn2.textContent?.trim()).toBe('Pokédex 1/151');

    // Another round where answer is already caught: doesn't count it twice
    const container3 = document.createElement('div');
    document.body.appendChild(container3);
    await initApp(container3, { api, rng });
    const dexBtn3 = container3.querySelector<HTMLButtonElement>('.dex-btn')!;
    expect(dexBtn3.textContent?.trim()).toBe('Pokédex 1/151');
    const pikachuBtn3 = Array.from(container3.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Pikachu'
    )!;
    pikachuBtn3.click();
    expect(JSON.parse(localStorage.getItem('pokequest.pokedex') || '[]')).toEqual([25]);
    expect(dexBtn3.textContent?.trim()).toBe('Pokédex 1/151');
  });

  it('21. Clicking .dex-btn shows .pokedex-view and hides .game-content. The view has a .dex-count (2 / 151 caught) and 151 .dex-cell elements in id order. Caught cells have class caught, an <img> whose src is the sprite and alt is the formatted name, a .dex-name with the formatted name, and one .type-badge per type (text = type name, class type-<name>). Uncaught cells have no <img> and show the padded number, e.g. #004.', async () => {
    localStorage.setItem('pokequest.pokedex', JSON.stringify([1, 4]));
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    dexBtn.click();

    // Allow any async fetches for pokedex
    await new Promise((resolve) => setTimeout(resolve, 50));

    const gameContent = container.querySelector<HTMLElement>('.game-content')!;
    expect(gameContent.style.display === 'none' || gameContent.hidden).toBe(true);

    const pokedexView = container.querySelector<HTMLElement>('.pokedex-view');
    expect(pokedexView).not.toBeNull();
    expect(pokedexView?.style.display).not.toBe('none');

    const dexCount = pokedexView?.querySelector<HTMLElement>('.dex-count');
    expect(dexCount?.textContent?.trim()).toBe('2 / 151 caught');

    const cells = pokedexView?.querySelectorAll<HTMLElement>('.dex-cell')!;
    expect(cells).toHaveLength(151);

    // Cell 0 -> id 1 (Bulbasaur, caught)
    const cell1 = cells[0];
    expect(cell1.classList.contains('caught')).toBe(true);
    const img1 = cell1.querySelector<HTMLImageElement>('img');
    expect(img1).not.toBeNull();
    expect(img1?.src).toBe('https://img.test/1.png');
    expect(img1?.alt).toBe('Bulbasaur');
    expect(cell1.querySelector<HTMLElement>('.dex-name')?.textContent?.trim()).toBe('Bulbasaur');
    const badge1 = cell1.querySelector<HTMLElement>('.type-badge');
    expect(badge1?.textContent?.trim()).toBe('grass');
    expect(badge1?.classList.contains('type-grass')).toBe(true);

    // Cell 1 -> id 2 (uncaught)
    const cell2 = cells[1];
    expect(cell2.classList.contains('caught')).toBe(false);
    expect(cell2.querySelector('img')).toBeNull();
    expect(cell2.textContent).toContain('#002');

    // Cell 3 -> id 4 (Charmander, caught)
    const cell4 = cells[3];
    expect(cell4.classList.contains('caught')).toBe(true);
    const img4 = cell4.querySelector<HTMLImageElement>('img');
    expect(img4).not.toBeNull();
    expect(img4?.src).toBe('https://img.test/4.png');
    expect(img4?.alt).toBe('Charmander');
    expect(cell4.querySelector<HTMLElement>('.dex-name')?.textContent?.trim()).toBe('Charmander');
    const badge4 = cell4.querySelector<HTMLElement>('.type-badge');
    expect(badge4?.textContent?.trim()).toBe('fire');
    expect(badge4?.classList.contains('type-fire')).toBe(true);
  });

  it('22. A .dex-back button hides the Pokédex and shows the quiz again, unchanged: same image src, same status text, same disabled state of the option buttons, "Next" still visible if it was.', async () => {
    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    // Answer round
    const pikachuBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Pikachu'
    )!;
    pikachuBtn.click();

    const img = container.querySelector<HTMLImageElement>('.pokemon-image')!;
    const statusEl = container.querySelector<HTMLElement>('.status')!;
    const nextBtn = container.querySelector<HTMLButtonElement>('.next-btn')!;

    const savedImgSrc = img.src;
    const savedStatus = statusEl.textContent;
    const nextVisible = !nextBtn.hidden && getComputedStyle(nextBtn).display !== 'none';
    expect(nextVisible).toBe(true);

    // Click pokedex
    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    dexBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Click back
    const backBtn = container.querySelector<HTMLButtonElement>('.dex-back')!;
    expect(backBtn).not.toBeNull();
    backBtn.click();

    const gameContent = container.querySelector<HTMLElement>('.game-content')!;
    expect(gameContent.style.display).not.toBe('none');
    expect(gameContent.hidden).toBe(false);

    const pokedexView = container.querySelector<HTMLElement>('.pokedex-view');
    expect(!pokedexView || pokedexView.style.display === 'none' || pokedexView.hidden).toBe(true);

    expect(img.src).toBe(savedImgSrc);
    expect(statusEl.textContent).toBe(savedStatus);
    const buttons = container.querySelectorAll<HTMLButtonElement>('.option-btn');
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }
    expect(!nextBtn.hidden && getComputedStyle(nextBtn).display !== 'none').toBe(true);
  });

  it('23. If getPokemon rejects for one caught id, that cell gets class error, still shows its number, and every other cell still renders.', async () => {
    localStorage.setItem('pokequest.pokedex', JSON.stringify([1, 7]));
    const api = {
      getPokemon: vi.fn(async (id: number) => {
        if (id === 7) {
          throw new PokeApiError('Squirtle fetch error');
        }
        return mockPokemons[id] ?? { id, name: `pokemon-${id}`, sprite: `https://img.test/${id}.png`, types: ['normal'] };
      }),
    };
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    dexBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const cells = container.querySelectorAll<HTMLElement>('.dex-cell');
    expect(cells).toHaveLength(151);

    const cell1 = cells[0]; // id 1
    expect(cell1.classList.contains('caught')).toBe(true);
    expect(cell1.classList.contains('error')).toBe(false);

    const cell7 = cells[6]; // id 7
    expect(cell7.classList.contains('error')).toBe(true);
    expect(cell7.textContent).toContain('#007');

    const cell2 = cells[1]; // id 2 uncaught
    expect(cell2.textContent).toContain('#002');
  });

  it('24. Safety: a caught Pokémon whose type is <b>x</b> gives a badge with exactly that textContent and no <b> element anywhere in the Pokédex.', async () => {
    localStorage.setItem('pokequest.pokedex', JSON.stringify([1]));
    const api = createMockApi({
      1: { id: 1, name: 'bulbasaur', sprite: 'https://img.test/1.png', types: ['<b>x</b>'] },
    });
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    dexBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const pokedexView = container.querySelector<HTMLElement>('.pokedex-view')!;
    const badge = pokedexView.querySelector<HTMLElement>('.type-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('<b>x</b>');
    expect(pokedexView.querySelectorAll('b')).toHaveLength(0);
  });

  it('25. A round that fails while the Pokédex is open must not show its error over the Pokédex. After .dex-back, the error view and its "Try again" button are visible.', async () => {
    let rejectRound: ((err: Error) => void) | null = null;
    let failNextRound = false;

    const api = {
      getPokemon: vi.fn(async (id: number) => {
        if (id === 25) {
          return mockPokemons[25];
        }
        if (failNextRound) {
          return new Promise<Pokemon>((_, reject) => {
            rejectRound = reject;
          });
        }
        return mockPokemons[id] ?? { id, name: `pokemon-${id}`, sprite: `https://img.test/${id}.png`, types: ['normal'] };
      }),
    };
    const rng = createFixedRng();

    await initApp(container, { api, rng });

    // Answer round 1
    const pikachuBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Pikachu'
    )!;
    pikachuBtn.click();

    // Next round will fail
    failNextRound = true;
    const nextBtn = container.querySelector<HTMLButtonElement>('.next-btn')!;
    nextBtn.click();

    // Open Pokédex while next round is loading
    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    dexBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Next round rejects
    expect(rejectRound).not.toBeNull();
    rejectRound!(new PokeApiError('Fetch error while dex open'));

    await new Promise((resolve) => setTimeout(resolve, 50));

    // .pokedex-view is still the only visible view (no visible .error-view)
    const pokedexView = container.querySelector<HTMLElement>('.pokedex-view');
    expect(pokedexView).not.toBeNull();
    expect(pokedexView?.style.display).not.toBe('none');

    const errorView = container.querySelector<HTMLElement>('.error-view');
    if (errorView) {
      expect(errorView.style.display).toBe('none');
    }

    // Click back
    const backBtn = container.querySelector<HTMLButtonElement>('.dex-back')!;
    backBtn.click();

    // After .dex-back, error view and retry button are visible
    const visibleErrorView = container.querySelector<HTMLElement>('.error-view')!;
    expect(visibleErrorView).not.toBeNull();
    expect(visibleErrorView.style.display).not.toBe('none');
    const retryBtn = visibleErrorView.querySelector<HTMLButtonElement>('.retry-btn');
    expect(retryBtn).not.toBeNull();
  });

  it('26. Storage that throws must not break the game: app loads, correct answer updates score and button to Pokédex 1/151', async () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error('QuotaExceeded or SecurityError: Access denied');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceeded or SecurityError: Access denied');
      }),
    } as unknown as Storage;

    const api = createMockApi();
    const rng = createFixedRng();

    await initApp(container, { api, rng, storage: throwingStorage });

    const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
    expect(dexBtn).not.toBeNull();
    expect(dexBtn.textContent?.trim()).toBe('Pokédex 0/151');

    const scoreEl = container.querySelector<HTMLElement>('.score-val')!;
    expect(scoreEl.textContent).toBe('0');

    // Click correct answer (Pikachu)
    const pikachuBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.option-btn')).find(
      (b) => b.textContent?.trim() === 'Pikachu'
    )!;
    pikachuBtn.click();

    expect(scoreEl.textContent).toBe('1');
    expect(dexBtn.textContent?.trim()).toBe('Pokédex 1/151');
  });
});



