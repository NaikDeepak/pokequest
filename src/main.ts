import './style.css';
import { createPokeApi, type Pokemon } from './pokeapi.ts';
import { applyAnswer, formatName, pickRound, type Score } from './quiz.ts';
import { addCaught, DEX_SIZE, loadCaught, saveCaught } from './pokedex.ts';

export type AppOptions = {
  api?: { getPokemon(id: number): Promise<Pokemon> };
  rng?: () => number;
  storage?: Storage;
};

// Reading window.localStorage itself throws when the browser blocks storage (e.g. cookies disabled).
function defaultStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export async function initApp(container: HTMLElement, options: AppOptions = {}): Promise<void> {
  const api = options.api ?? createPokeApi();
  const rng = options.rng ?? Math.random;
  const storage = options.storage ?? defaultStorage();

  let caught = loadCaught(storage);
  let initialBest = 0;
  if (storage) {
    try {
      initialBest = parseInt(storage.getItem('pokequest.best') || '0', 10) || 0;
    } catch {
      initialBest = 0;
    }
  }
  let scoreState: Score = { score: 0, streak: 0, best: initialBest };
  let isAnswered = false;
  let isDexOpen = false;

  container.innerHTML = `
    <div class="quiz-card">
      <div class="score-bar">
        <div class="score-pill">
          <span>Score</span>
          <span class="score-val">${scoreState.score}</span>
        </div>
        <div class="score-pill">
          <span>Streak</span>
          <span class="streak-val">${scoreState.streak}</span>
        </div>
        <div class="score-pill">
          <span>Best</span>
          <span class="best-val">${scoreState.best}</span>
        </div>
        <button class="dex-btn" type="button">Pokédex ${caught.length}/${DEX_SIZE}</button>
      </div>
      <div class="game-content">
        <div class="image-container">
          <img class="pokemon-image silhouette" alt="Who's that Pokémon?" />
        </div>
        <div class="status" role="status"></div>
        <div class="options-grid"></div>
        <button class="next-btn" style="display: none;" hidden>Next</button>
      </div>
    </div>
  `;

  const scoreValEl = container.querySelector<HTMLElement>('.score-val')!;
  const streakValEl = container.querySelector<HTMLElement>('.streak-val')!;
  const bestValEl = container.querySelector<HTMLElement>('.best-val')!;
  const dexBtn = container.querySelector<HTMLButtonElement>('.dex-btn')!;
  const gameContentEl = container.querySelector<HTMLElement>('.game-content')!;
  const imgEl = container.querySelector<HTMLImageElement>('.pokemon-image')!;
  const statusEl = container.querySelector<HTMLElement>('.status')!;
  const optionsGridEl = container.querySelector<HTMLElement>('.options-grid')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('.next-btn')!;

  function updateDexBtn() {
    dexBtn.textContent = `Pokédex ${caught.length}/${DEX_SIZE}`;
  }

  function updateScoreDisplay() {
    scoreValEl.textContent = String(scoreState.score);
    streakValEl.textContent = String(scoreState.streak);
    bestValEl.textContent = String(scoreState.best);
    if (storage) {
      try {
        storage.setItem('pokequest.best', String(scoreState.best));
      } catch {
        // Swallow storage exceptions (e.g. quota exceeded or private mode)
      }
    }
  }

  function showError(message: string) {
    gameContentEl.style.display = 'none';
    let errorView = container.querySelector<HTMLElement>('.error-view');
    if (!errorView) {
      errorView = document.createElement('div');
      errorView.className = 'error-view';
      container.querySelector('.quiz-card')!.appendChild(errorView);
    } else {
      errorView.replaceChildren();
    }

    const p = document.createElement('p');
    p.className = 'error-message';
    p.textContent = message;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.textContent = 'Try again';
    retryBtn.addEventListener('click', () => {
      errorView?.remove();
      gameContentEl.style.display = '';
      loadRound();
    });

    errorView.replaceChildren(p, retryBtn);

    if (isDexOpen) {
      errorView.style.display = 'none';
    } else {
      errorView.style.display = '';
    }
  }

  async function loadRound(): Promise<void> {
    isAnswered = false;
    statusEl.textContent = '';
    nextBtn.hidden = true;
    nextBtn.style.display = 'none';
    optionsGridEl.innerHTML = '';
    imgEl.classList.add('silhouette');
    imgEl.alt = "Who's that Pokémon?";
    imgEl.removeAttribute('src');

    const round = pickRound(rng);

    try {
      const pokemons = await Promise.all(round.optionIds.map((id) => api.getPokemon(id)));
      const answerPokemon = pokemons.find((p) => p.id === round.answerId);
      if (!answerPokemon) {
        throw new Error('Answer Pokémon not found among options');
      }

      imgEl.src = answerPokemon.sprite;

      pokemons.forEach((pokemon) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = formatName(pokemon.name);
        btn.addEventListener('click', () => {
          if (isAnswered) return;
          isAnswered = true;

          const isCorrect = pokemon.id === answerPokemon.id;
          scoreState = applyAnswer(scoreState, isCorrect);
          updateScoreDisplay();

          imgEl.classList.remove('silhouette');
          imgEl.alt = formatName(answerPokemon.name);

          const allButtons = optionsGridEl.querySelectorAll<HTMLButtonElement>('.option-btn');
          allButtons.forEach((b) => {
            b.disabled = true;
            if (b.textContent === formatName(answerPokemon.name)) {
              b.classList.add('correct');
            }
          });

          if (isCorrect) {
            statusEl.textContent = 'Correct!';
            caught = addCaught(caught, answerPokemon.id);
            saveCaught(storage, caught);
            updateDexBtn();
          } else {
            btn.classList.add('wrong');
            statusEl.textContent = `It's ${formatName(answerPokemon.name)}!`;
          }

          nextBtn.hidden = false;
          nextBtn.style.display = 'block';
        });

        optionsGridEl.appendChild(btn);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(message);
    }
  }

  async function openPokedex(): Promise<void> {
    isDexOpen = true;
    gameContentEl.style.display = 'none';
    const errorView = container.querySelector<HTMLElement>('.error-view');
    if (errorView) {
      errorView.style.display = 'none';
    }

    let pokedexView = container.querySelector<HTMLElement>('.pokedex-view');
    if (pokedexView) {
      pokedexView.remove();
    }

    pokedexView = document.createElement('div');
    pokedexView.className = 'pokedex-view';
    container.querySelector('.quiz-card')!.appendChild(pokedexView);

    const header = document.createElement('div');
    header.className = 'dex-header';

    const title = document.createElement('h2');
    title.className = 'dex-title';
    title.textContent = 'Pokédex';

    const count = document.createElement('span');
    count.className = 'dex-count';
    count.textContent = `${caught.length} / ${DEX_SIZE} caught`;

    const backBtn = document.createElement('button');
    backBtn.className = 'dex-back';
    backBtn.type = 'button';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', closePokedex);

    header.appendChild(title);
    header.appendChild(count);
    header.appendChild(backBtn);
    pokedexView.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'dex-grid';
    pokedexView.appendChild(grid);

    const caughtSet = new Set(caught);
    const fetchPromises: Promise<void>[] = [];

    for (let id = 1; id <= DEX_SIZE; id++) {
      const cell = document.createElement('div');
      cell.className = 'dex-cell';

      const numSpan = document.createElement('span');
      numSpan.className = 'dex-num';
      numSpan.textContent = `#${String(id).padStart(3, '0')}`;
      cell.appendChild(numSpan);

      grid.appendChild(cell);

      if (caughtSet.has(id)) {
        const p = (async () => {
          try {
            const pokemon = await api.getPokemon(id);
            cell.classList.add('caught');

            const img = document.createElement('img');
            img.className = 'dex-art';
            img.src = pokemon.sprite;
            img.alt = formatName(pokemon.name);
            cell.appendChild(img);

            const nameEl = document.createElement('span');
            nameEl.className = 'dex-name';
            nameEl.textContent = formatName(pokemon.name);
            cell.appendChild(nameEl);

            if (pokemon.types && pokemon.types.length > 0) {
              const typesEl = document.createElement('div');
              typesEl.className = 'dex-types';
              pokemon.types.forEach((type) => {
                const badge = document.createElement('span');
                badge.className = `type-badge type-${type.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
                badge.textContent = type;
                typesEl.appendChild(badge);
              });
              cell.appendChild(typesEl);
            }
          } catch {
            cell.classList.add('error');
          }
        })();
        fetchPromises.push(p);
      }
    }

    await Promise.all(fetchPromises);
  }

  function closePokedex(): void {
    isDexOpen = false;
    const pokedexView = container.querySelector<HTMLElement>('.pokedex-view');
    if (pokedexView) {
      pokedexView.remove();
    }

    const errorView = container.querySelector<HTMLElement>('.error-view');
    if (errorView) {
      errorView.style.display = '';
      gameContentEl.style.display = 'none';
    } else {
      gameContentEl.style.display = '';
    }
  }

  dexBtn.addEventListener('click', () => {
    openPokedex();
  });

  nextBtn.addEventListener('click', () => {
    loadRound();
  });

  await loadRound();
}

if (typeof document !== 'undefined' && !import.meta.env?.VITEST) {
  const appRoot = document.querySelector<HTMLElement>('#app');
  if (appRoot) {
    initApp(appRoot);
  }
}
