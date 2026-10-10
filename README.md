# PokeQuest

A "Who's that Pokémon?" quiz for the 151 original Pokémon. You see a silhouette and pick its name from four options;
the art is revealed, and your score, streak and best are kept. Every Pokémon you name correctly is caught, and the
Pokédex shows all the ones you've caught, with art and types.

Data comes from the free [PokeAPI](https://pokeapi.co); there are no keys and no server.

```bash
npm ci
npm run dev        # play at http://localhost:5173
npm test           # 26 unit and DOM tests (Vitest + jsdom), no network
npm run typecheck
npm run build
```

## How it was built

Built by three AI coding agents working through [agent-notepad](https://github.com/NaikDeepak/agent-notepad):
Claude Code as the lead (specs, review, merge), Antigravity (`agy`, Gemini) as the builder, and Codex as a read-only
second reviewer. The specs it was built from are in [`docs/tasks/`](docs/tasks/), with their review rounds, and the
git history shows what each agent did.

- Silhouette quiz: 29 minutes from task to merge, one review round.
- Pokédex: 21 minutes from task to merge, one review round, $4.21 in total across the three agents at pay-as-you-go
  API prices.
