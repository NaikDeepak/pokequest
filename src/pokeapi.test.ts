import { describe, it, expect, vi } from 'vitest';
import { createPokeApi, PokeApiError } from './pokeapi.ts';

describe('pokeapi', () => {
  it('calls https://pokeapi.co/api/v2/pokemon/25 and maps to Pokemon format', async () => {
    const mockData = {
      id: 25,
      name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      sprites: {
        other: {
          'official-artwork': {
            front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
          },
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const api = createPokeApi(fetchMock as unknown as typeof fetch);
    const pokemon = await api.getPokemon(25);

    expect(fetchMock).toHaveBeenCalledWith('https://pokeapi.co/api/v2/pokemon/25');
    expect(pokemon).toEqual({
      id: 25,
      name: 'pikachu',
      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
      types: ['electric'],
    });
  });

  it('serves a second call from cache without calling fetch again', async () => {
    const mockData = {
      id: 25,
      name: 'pikachu',
      types: [{ type: { name: 'electric' } }],
      sprites: {
        other: {
          'official-artwork': {
            front_default: 'https://example.com/25.png',
          },
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const api = createPokeApi(fetchMock as unknown as typeof fetch);
    const first = await api.getPokemon(25);
    const second = await api.getPokemon(25);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('rejects non-OK response (404) with PokeApiError and does not cache failure so later call retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 25,
          name: 'pikachu',
          types: [{ type: { name: 'electric' } }],
          sprites: {
            other: {
              'official-artwork': {
                front_default: 'https://example.com/25.png',
              },
            },
          },
        }),
      });

    const api = createPokeApi(fetchMock as unknown as typeof fetch);

    await expect(api.getPokemon(25)).rejects.toThrow(PokeApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const retryResult = await api.getPokemon(25);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryResult.name).toBe('pikachu');
  });
});
