import { describe, it, expect } from 'vitest';
import { pickRound, applyAnswer, formatName, type Score } from './quiz.ts';

function createSeededRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('quiz', () => {
  it('pickRound with a seeded rng returns 4 distinct ids, all in 1..151, answerId among them (run 200 seeds)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createSeededRng(seed);
      const round = pickRound(rng);

      expect(round.optionIds).toHaveLength(4);
      expect(new Set(round.optionIds).size).toBe(4);

      for (const id of round.optionIds) {
        expect(id).toBeGreaterThanOrEqual(1);
        expect(id).toBeLessThanOrEqual(151);
        expect(Number.isInteger(id)).toBe(true);
      }

      expect(round.optionIds).toContain(round.answerId);
    }
  });

  it('pickRound(rng, 4) returns exactly ids 1-4 in some order', () => {
    const rng = createSeededRng(42);
    const round = pickRound(rng, 4);

    expect(round.optionIds).toHaveLength(4);
    expect(new Set(round.optionIds).size).toBe(4);
    expect([...round.optionIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(round.optionIds).toContain(round.answerId);
  });

  it('applyAnswer: correct updates score/streak/best, wrong resets streak leaving score and best unchanged', () => {
    const s0: Score = { score: 0, streak: 0, best: 0 };

    const s1 = applyAnswer(s0, true);
    expect(s1).toEqual({ score: 1, streak: 1, best: 1 });
    expect(s0).toEqual({ score: 0, streak: 0, best: 0 }); // immutable

    const s2 = applyAnswer(s1, true);
    expect(s2).toEqual({ score: 2, streak: 2, best: 2 });

    const s3 = applyAnswer(s2, false);
    expect(s3).toEqual({ score: 2, streak: 0, best: 2 });

    const s4 = applyAnswer(s3, true);
    expect(s4).toEqual({ score: 3, streak: 1, best: 2 });

    const s5 = applyAnswer(s4, true);
    expect(s5).toEqual({ score: 4, streak: 2, best: 2 });

    const s6 = applyAnswer(s5, true);
    expect(s6).toEqual({ score: 5, streak: 3, best: 3 });
  });

  it('formatName formats special names and standard names properly', () => {
    expect(formatName('mr-mime')).toBe('Mr. Mime');
    expect(formatName('nidoran-f')).toBe('Nidoran ♀');
    expect(formatName('nidoran-m')).toBe('Nidoran ♂');
    expect(formatName('farfetchd')).toBe("Farfetch'd");
    expect(formatName('pikachu')).toBe('Pikachu');
  });
});
