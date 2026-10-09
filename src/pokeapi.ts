export type Pokemon = {
  id: number;
  name: string;
  sprite: string;
  types: string[];
};

export class PokeApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PokeApiError';
  }
}

export function createPokeApi(fetchFn: typeof fetch = fetch): {
  getPokemon(id: number): Promise<Pokemon>;
} {
  const cache = new Map<number, Pokemon>();

  return {
    async getPokemon(id: number): Promise<Pokemon> {
      const cached = cache.get(id);
      if (cached) {
        return cached;
      }

      let res: Response;
      try {
        res = await fetchFn(`https://pokeapi.co/api/v2/pokemon/${id}`);
      } catch (err) {
        throw new PokeApiError(err instanceof Error ? err.message : String(err));
      }

      if (!res.ok) {
        throw new PokeApiError(`PokeAPI request failed with status ${res.status}: ${res.statusText}`);
      }

      let data: any;
      try {
        data = await res.json();
      } catch (err) {
        throw new PokeApiError(err instanceof Error ? err.message : String(err));
      }

      const pokemon: Pokemon = {
        id: data.id,
        name: data.name,
        sprite: data.sprites?.other?.['official-artwork']?.front_default ?? '',
        types: Array.isArray(data.types) ? data.types.map((t: any) => t.type?.name).filter(Boolean) : [],
      };

      cache.set(id, pokemon);
      return pokemon;
    },
  };
}
