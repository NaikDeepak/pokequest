# Task: "Who's that Pokémon?" silhouette quiz

**Assigned to:** agy  **Lead / reviewer:** claude  **Second review:** codex (read-only)
**Branch:** `feat/silhouette-quiz`  **Worktree:** `../pokequest-wt-agy`

## Goal
Open the page, see a black silhouette of a Gen-1 Pokémon and four name buttons. Pick one: the art is revealed,
you're told right or wrong, the score / streak / best update, and "Next" loads a new round.

## Files you may touch (nothing else)
- `src/pokeapi.ts`, `src/pokeapi.test.ts`
- `src/quiz.ts`, `src/quiz.test.ts`
- `src/main.ts`, `src/main.test.ts`
- `src/style.css`
- `index.html` (only inside `<body>` if you need it)

## Runtime boundary
Browser only, no server, no API key. Data from the free PokeAPI: `GET https://pokeapi.co/api/v2/pokemon/{id}`.
Fields used: `id`, `name` (e.g. `mr-mime`), `types[].type.name`, `sprites.other["official-artwork"].front_default`.
Tests never touch the network: inject `fetch`. Best score lives in `localStorage` key `pokequest.best`.
Vitest 5; for DOM tests put `// @vitest-environment jsdom` at the top of the test file. No new dependencies.

## API (write exactly these)
```ts
// src/pokeapi.ts
export type Pokemon = { id: number; name: string; sprite: string; types: string[] };
export class PokeApiError extends Error {}
export function createPokeApi(fetchFn: typeof fetch = fetch): { getPokemon(id: number): Promise<Pokemon> };
// src/quiz.ts
export type Round = { answerId: number; optionIds: number[] };          // 4 distinct ids, answer among them
export type Score = { score: number; streak: number; best: number };
export function pickRound(rng: () => number, maxId?: number): Round;     // maxId defaults to 151
export function applyAnswer(s: Score, correct: boolean): Score;
export function formatName(apiName: string): string;
```

## Test cases (write these first, make them fail, then implement)
pokeapi
1. `getPokemon(25)` calls `https://pokeapi.co/api/v2/pokemon/25` and maps to `{ id: 25, name: "pikachu", sprite, types: ["electric"] }`.
2. A second `getPokemon(25)` is served from cache: fetch called once.
3. Non-OK response (404) rejects with `PokeApiError`; a later call retries (failures are not cached).
quiz
4. `pickRound` with a seeded rng returns 4 distinct ids, all in 1..151, `answerId` among them (run 200 seeds).
5. `pickRound(rng, 4)` returns exactly ids 1–4 in some order.
6. `applyAnswer`: correct → score+1, streak+1, best = max(best, streak); wrong → streak 0, score and best unchanged.
7. `formatName`: `"mr-mime"` → `"Mr. Mime"`, `"nidoran-f"` → `"Nidoran ♀"`, `"nidoran-m"` → `"Nidoran ♂"`, `"farfetchd"` → `"Farfetch'd"`, `"pikachu"` → `"Pikachu"`.
main (jsdom, fake api + fixed rng)
8. After load: an `<img>` with class `silhouette` and 4 option buttons with formatted names.
9. Clicking the right button: image loses `silhouette`, a status shows "Correct", score shows 1, buttons disabled, "Next" visible.
10. Clicking a wrong button: status says "It's <Right Name>!", the right button gets class `correct`, the clicked one `wrong`, streak 0.
11. Best score is read from and written to `localStorage["pokequest.best"]`.
12. Edge: api rejects → an error message and a "Try again" button that retries.

## Look
Silhouette = CSS `filter: brightness(0)` removed with a short transition on reveal. Centered card, max-width 420px,
big image (240px), 2×2 option grid, score bar on top. Works on a phone width. Keep it simple and clean.

## Done when
- [ ] `npm test`, `npm run typecheck` and `npm run build` all pass; `npm test` passes 3 runs in a row.
- [ ] Commit on `feat/silhouette-quiz` (no push).
- [ ] `scripts/collab.sh handoff agy claude "feat/silhouette-quiz · <done> · <test result> · <anything unsure>"`
- [ ] `scripts/collab.sh release agy`

## Don'ts
- No new dependencies (node_modules is already installed; don't run npm install). No changes outside the file list.
- No background commands, no dev server. One command per call. Never call the real API from tests.
