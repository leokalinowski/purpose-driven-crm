/**
 * Stripe product & price configuration for REOP Hub subscription tiers.
 * Supports both live and test mode IDs.
 */

/** Live-mode tier config (production) */
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
      'Personal dashboard with weekly metrics',
      'SphereSync task engine',
      'Contact database (500 contacts)',
      'Weekly coaching submissions',
      'Monthly newsletter',
      'Historical performance tracking',
      'Profile & settings management',
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

/** Test-mode tier config (Stripe test keys) */
export const STRIPE_TIERS_TEST = {
  core: {
    name: 'Core',
    monthly: {
      price_id: 'price_1T87J0QGA8aVyaHS7vCe7Fw8',
      product_id: 'prod_U6Jwx4nLCE1I2s',
      amount: 149,
    },
    annual: {
      price_id: 'price_1T87JNQGA8aVyaHS0fReVKmL',
      product_id: 'prod_U6JxCNA2455QJe',
      amount: 1490,
    },
    founder: {
      price_id: 'price_1T87JeQGA8aVyaHSYcaEONPJ',
      product_id: 'prod_U6Jx3oB19agtnz',
      amount: 997,
      label: '$997 for 6 months, then $149/mo',
    },
    features: STRIPE_TIERS.core.features,
    role: 'core' as const,
  },
  managed: {
    name: 'Managed',
    monthly: {
      price_id: 'price_1T87JzQGA8aVyaHSBCJ7pzWT',
      product_id: 'prod_U6JxoQJVRqucDT',
      amount: 449,
    },
    annual: {
      price_id: 'price_1T87KUQGA8aVyaHSnpM40Lh3',
      product_id: 'prod_U6JyhK7qt3CK4K',
      amount: 4490,
    },
    founder: {
      price_id: 'price_1T87KlQGA8aVyaHSN5VInftx',
      product_id: 'prod_U6JydMsJcVubkF',
      amount: 2997,
      label: '$2,997 for 6 months, then $449/mo',
    },
    features: STRIPE_TIERS.managed.features,
    role: 'managed' as const,
  },
} as const;

/** Get the correct tier config based on test/live mode */
export function getStripeTiers(isTestMode: boolean) {
  return isTestMode ? STRIPE_TIERS_TEST : STRIPE_TIERS;
}

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

/** Map a Stripe price_id to its tier name (checks both live and test IDs) */
export function getTierFromPriceId(priceId: string, isTestMode?: boolean): 'core' | 'managed' | null {
  const configs = isTestMode !== undefined
    ? [isTestMode ? STRIPE_TIERS_TEST : STRIPE_TIERS]
    : [STRIPE_TIERS, STRIPE_TIERS_TEST]; // check both if mode unknown

  for (const tiers of configs) {
    if (
      priceId === tiers.core.monthly.price_id ||
      priceId === tiers.core.annual.price_id ||
      priceId === tiers.core.founder.price_id
    ) return 'core';
    if (
      priceId === tiers.managed.monthly.price_id ||
      priceId === tiers.managed.annual.price_id ||
      priceId === tiers.managed.founder.price_id
    ) return 'managed';
  }
  return null;
}

/** Check if a price_id is a founder plan */
export function isFounderPrice(priceId: string): boolean {
  return FOUNDER_PRICE_IDS.includes(priceId as any) ||
    priceId === STRIPE_TIERS_TEST.core.founder.price_id ||
    priceId === STRIPE_TIERS_TEST.managed.founder.price_id;
}
