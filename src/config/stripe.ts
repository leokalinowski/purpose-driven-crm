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

/** All valid price IDs for lookup */
export const ALL_PRICE_IDS = [
  STRIPE_TIERS.core.monthly.price_id,
  STRIPE_TIERS.core.annual.price_id,
  STRIPE_TIERS.managed.monthly.price_id,
  STRIPE_TIERS.managed.annual.price_id,
] as const;

/** Map a Stripe price_id to its tier name */
export function getTierFromPriceId(priceId: string): 'core' | 'managed' | null {
  if (
    priceId === STRIPE_TIERS.core.monthly.price_id ||
    priceId === STRIPE_TIERS.core.annual.price_id
  )
    return 'core';
  if (
    priceId === STRIPE_TIERS.managed.monthly.price_id ||
    priceId === STRIPE_TIERS.managed.annual.price_id
  )
    return 'managed';
  return null;
}
