export const STATUS_LABELS = ['active', 'pending', 'inactive'] as const;
export type StatusLabel = (typeof STATUS_LABELS)[number];

export const ACCOUNT_TIERS = ['free', 'pro', 'enterprise'] as const;
export type AccountTier = (typeof ACCOUNT_TIERS)[number];

export const RATING_LEVELS = [1, 2, 3, 4, 5] as const;
export type RatingLevel = (typeof RATING_LEVELS)[number];
