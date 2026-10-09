export type Round = {
  answerId: number;
  optionIds: number[];
};

export type Score = {
  score: number;
  streak: number;
  best: number;
};

export function pickRound(rng: () => number, maxId = 151): Round {
  if (maxId < 4) {
    throw new Error('maxId must be at least 4');
  }

  const options = new Set<number>();
  while (options.size < 4) {
    const val = rng();
    const clamped = Math.max(0, Math.min(0.999999999999, val));
    const id = Math.floor(clamped * maxId) + 1;
    options.add(id);
  }

  const optionIds = Array.from(options);
  const answerIdx = Math.floor(Math.max(0, Math.min(0.999999999999, rng())) * optionIds.length);
  const answerId = optionIds[answerIdx];

  return { answerId, optionIds };
}

export function applyAnswer(s: Score, correct: boolean): Score {
  if (correct) {
    const nextStreak = s.streak + 1;
    return {
      score: s.score + 1,
      streak: nextStreak,
      best: Math.max(s.best, nextStreak),
    };
  }

  return {
    score: s.score,
    streak: 0,
    best: s.best,
  };
}

const SPECIAL_NAMES: Record<string, string> = {
  'mr-mime': 'Mr. Mime',
  'nidoran-f': 'Nidoran ♀',
  'nidoran-m': 'Nidoran ♂',
  farfetchd: "Farfetch'd",
};

export function formatName(apiName: string): string {
  const normalized = apiName.trim().toLowerCase();
  if (SPECIAL_NAMES[normalized]) {
    return SPECIAL_NAMES[normalized];
  }

  return normalized
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
