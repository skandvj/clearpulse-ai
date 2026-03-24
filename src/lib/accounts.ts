export const ACCOUNT_TIERS = ["ENTERPRISE", "GROWTH", "STARTER"] as const;

export type AccountTier = (typeof ACCOUNT_TIERS)[number];

const TIER_LABELS: Record<AccountTier, string> = {
  ENTERPRISE: "Enterprise",
  GROWTH: "Growth",
  STARTER: "Starter",
};

export function normalizeTier(value?: string | null): AccountTier | null {
  if (!value) return null;

  const normalized = value.trim().replace(/[\s-]+/g, "_").toUpperCase();
  return ACCOUNT_TIERS.includes(normalized as AccountTier)
    ? (normalized as AccountTier)
    : null;
}

export function formatTierLabel(value?: string | null): string | null {
  const normalized = normalizeTier(value);

  if (normalized) {
    return TIER_LABELS[normalized];
  }

  const fallback = value?.trim();
  return fallback ? fallback : null;
}

export function getTierVariants(value?: string | null): string[] {
  const normalized = normalizeTier(value);
  if (!normalized) return [];

  const label = TIER_LABELS[normalized];

  return Array.from(
    new Set([
      normalized,
      label,
      normalized.toLowerCase(),
      label.toLowerCase(),
    ])
  );
}
