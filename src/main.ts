import './style.css';
import { createPokeApi, type Pokemon } from './pokeapi.ts';
import { applyAnswer, formatName, pickRound, type Score } from './quiz.ts';

export type AppOptions = {
  api?: { getPokemon(id: number): Promise<Pokemon> };
  rng?: () => number;
  storage?: Storage;
};

export async function initApp(container: HTMLElement, options: AppOptions = {}): Promise<void> {
  const api = options.api ?? createPokeApi();
  const rng = options.rng ?? Math.random;
  const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);

  const initialBest = storage ? parseInt(storage.getItem('pokequest.best') || '0', 10) || 0 : 0;
  let scoreState: Score = { score: 0, streak: 0, best: initialBest };
  let isAnswered = false;

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
  const gameContentEl = container.querySelector<HTMLElement>('.game-content')!;
  const imgEl = container.querySelector<HTMLImageElement>('.pokemon-image')!;
  const statusEl = container.querySelector<HTMLElement>('.status')!;
  const optionsGridEl = container.querySelector<HTMLElement>('.options-grid')!;
  const nextBtn = container.querySelector<HTMLButtonElement>('.next-btn')!;

  function updateScoreDisplay() {
    scoreValEl.textContent = String(scoreState.score);
    streakValEl.textContent = String(scoreState.streak);
    bestValEl.textContent = String(scoreState.best);
    if (storage) {
      storage.setItem('pokequest.best', String(scoreState.best));
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
