/**
 * Stripe product & price configuration for REOP Hub subscription tiers.
 */

export const STRIPE_TIERS = {
  core: {
    name: 'Core',
    monthly: {
      price_id: 'price_1T809vQGA8aVyaHSqHxPGZVH',
      product_id: 'prod_U6CZnBRXAi2jey',
      amount: 149,
    },
    annual: {
      price_id: 'price_1T80BTQGA8aVyaHSwA5MG8Wx',
      product_id: 'prod_U6CanelVG5Ilvn',
      amount: 1490,
    },
    founder: {
      price_id: 'price_1T82T9QGA8aVyaHSx4NYVQCl',
      product_id: 'prod_U6Ex7tgKBZtZc5',
      amount: 997,
      label: '$997 for 6 months, then $149/mo',
    },
    features: [
      'SphereSync task engine',
      'Contact database (500 contacts)',
      'Weekly coaching submissions',
      'Monthly newsletter',
      'Support tickets',
    ],
    role: 'core' as const,
  },
  managed: {
    name: 'Managed',
    monthly: {
      price_id: 'price_1T80CiQGA8aVyaHSTcBId8Ss',
      product_id: 'prod_U6CbXJqnPWpRVp',
      amount: 449,
    },
    annual: {
      price_id: 'price_1T80DBQGA8aVyaHSXggTaq9Z',
      product_id: 'prod_U6CctQ78FSyxvp',
      amount: 4490,
    },
    founder: {
      price_id: 'price_1T82UbQGA8aVyaHSwPJgIqXm',
      product_id: 'prod_U6Eyw4OBAEIm9V',
      amount: 2997,
      label: '$2,997 for 6 months, then $449/mo',
    },
    features: [
      'Everything in Core',
      'Contact database (1,000 contacts)',
      'Event management',
      'Pipeline & deal tracking',
      'Social media scheduler',
    ],
    role: 'managed' as const,
  },
} as const;

/** Founder plan configuration for edge function use */
export const FOUNDER_CONFIG = {
  core: {
    founderPriceId: STRIPE_TIERS.core.founder.price_id,
    founderProductId: STRIPE_TIERS.core.founder.product_id,
    monthlyPriceId: STRIPE_TIERS.core.monthly.price_id,
    amountCents: 99700,
  },
  managed: {
    founderPriceId: STRIPE_TIERS.managed.founder.price_id,
    founderProductId: STRIPE_TIERS.managed.founder.product_id,
    monthlyPriceId: STRIPE_TIERS.managed.monthly.price_id,
    amountCents: 299700,
  },
} as const;

/** All founder price IDs */
export const FOUNDER_PRICE_IDS = [
  STRIPE_TIERS.core.founder.price_id,
  STRIPE_TIERS.managed.founder.price_id,
] as const;

/** All valid price IDs for lookup */
export const ALL_PRICE_IDS = [
  STRIPE_TIERS.core.monthly.price_id,
  STRIPE_TIERS.core.annual.price_id,
  STRIPE_TIERS.core.founder.price_id,
  STRIPE_TIERS.managed.monthly.price_id,
  STRIPE_TIERS.managed.annual.price_id,
  STRIPE_TIERS.managed.founder.price_id,
] as const;

/** Map a Stripe price_id to its tier name */
export function getTierFromPriceId(priceId: string): 'core' | 'managed' | null {
  if (
    priceId === STRIPE_TIERS.core.monthly.price_id ||
    priceId === STRIPE_TIERS.core.annual.price_id ||
    priceId === STRIPE_TIERS.core.founder.price_id
  )
    return 'core';
  if (
    priceId === STRIPE_TIERS.managed.monthly.price_id ||
    priceId === STRIPE_TIERS.managed.annual.price_id ||
    priceId === STRIPE_TIERS.managed.founder.price_id
  )
    return 'managed';
  return null;
}

/** Check if a price_id is a founder plan */
export function isFounderPrice(priceId: string): boolean {
  return FOUNDER_PRICE_IDS.includes(priceId as any);
}
