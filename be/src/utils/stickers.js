/**
 * Student stickers: one completion + one tier per assignment (0-10 scale).
 * Tier and completion are locked to the first graded submission for that assignment;
 * later resubmits do not change stickers.
 */

/** @typedef {'participation' | 'pass' | 'good' | 'great' | 'excellent'} StickerTierCode */

export const STICKER_TIER_ORDER = [
  'participation',
  'pass',
  'good',
  'great',
  'excellent',
];

export const STICKER_TIER_META = {
  participation: {
    code: 'participation',
    label: 'C\u1ed1 g\u1eafng',
    emoji: '\uD83C\uDF31',
    minScore: 0,
  },
  pass: {
    code: 'pass',
    label: '\u0110\u1ea1t',
    emoji: '\uD83C\uDF8B',
    minScore: 5,
  },
  good: {
    code: 'good',
    label: 'Kh\xe1',
    emoji: '\u2b50',
    minScore: 6.5,
  },
  great: {
    code: 'great',
    label: 'Gi\u1ecfi',
    emoji: '\uD83C\uDF1F',
    minScore: 8,
  },
  excellent: {
    code: 'excellent',
    label: 'Xu\u1ea5t s\u1eafc',
    emoji: '\uD83C\uDFC6',
    minScore: 9.5,
  },
};

/**
 * @param {unknown} score
 * @returns {StickerTierCode}
 */
export function scoreToStickerTier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return 'participation';
  }
  if (n >= 9.5) return 'excellent';
  if (n >= 8) return 'great';
  if (n >= 6.5) return 'good';
  if (n >= 5) return 'pass';
  return 'participation';
}

/**
 * @param {Array<{ assignment_id: import('mongodb').ObjectId | string, created_at: Date, ai_result?: { score?: number } | null }>} rows
 */
export function computeStickerStatsFromSubmissionRows(rows) {
  /** Earliest graded row per assignment (stickers locked to first graded attempt). */
  /** @type {Map<string, { created_at: Date, ai_result: object }>} */
  const firstGradedByAssignment = new Map();

  for (const row of rows) {
    if (!row?.assignment_id || !row.created_at || row.ai_result == null) continue;
    const aid =
      typeof row.assignment_id === 'string'
        ? row.assignment_id
        : row.assignment_id.toString();
    const prev = firstGradedByAssignment.get(aid);
    const t = new Date(row.created_at).getTime();
    if (!prev || t < new Date(prev.created_at).getTime()) {
      firstGradedByAssignment.set(aid, {
        created_at: row.created_at,
        ai_result: row.ai_result,
      });
    }
  }

  /** @type {Record<string, number>} */
  const by_tier = {
    participation: 0,
    pass: 0,
    good: 0,
    great: 0,
    excellent: 0,
  };

  let assignments_with_grade = 0;

  for (const [, first] of firstGradedByAssignment) {
    assignments_with_grade += 1;
    const tier = scoreToStickerTier(first.ai_result.score);
    by_tier[tier] = (by_tier[tier] || 0) + 1;
  }

  const completion_stickers = assignments_with_grade;
  const tier_stickers_total = assignments_with_grade;
  const total_sticker_count = completion_stickers + tier_stickers_total;

  return {
    assignments_with_grade,
    completion_stickers,
    by_tier,
    tier_stickers_total,
    total_sticker_count,
  };
}

/**
 * @param {string} tierCode
 */
export function stickerTierPublicMeta(tierCode) {
  const meta = STICKER_TIER_META[tierCode] || STICKER_TIER_META.participation;
  return {
    code: meta.code,
    label: meta.label,
    emoji: meta.emoji,
  };
}
