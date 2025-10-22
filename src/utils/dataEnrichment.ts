import { Contact } from '@/hooks/useContacts';

export interface EnrichedContact extends Contact {
  enrichment_score: number;
  enrichment_suggestions: string[];
  enriched_fields: Record<string, any>;
  data_quality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface EnrichmentResult {
  contact: EnrichedContact;
  changes_made: string[];
  suggestions: string[];
}

/**
 * Core data enrichment utilities - all internal, no external APIs
 */

// Phone number standardization
export const standardizePhone = (phone?: string | null): string | null => {
  if (!phone) return null;

  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');

  // Handle various formats
  if (digitsOnly.length === 10) {
    // US format: 5551234567 -> (555) 123-4567
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US format with country code: 15551234567 -> +1 (555) 123-4567
    const number = digitsOnly.slice(1);
    return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  } else if (digitsOnly.length === 11) {
    // International format: assume US -> +1 (555) 123-4567
    return `+1 (${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  // For other formats, just clean up the digits
  return phone.replace(/\s+/g, ' ').trim();
};

// Email format validation and standardization
export const standardizeEmail = (email?: string | null): string | null => {
  if (!email) return null;

  const trimmed = email.trim().toLowerCase();

  // Basic email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return null; // Invalid format
  }

  return trimmed;
};

// Name normalization
export const normalizeName = (firstName?: string | null, lastName?: string | null) => {
  const normalizePart = (name?: string | null): string => {
    if (!name) return '';
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return {
    first_name: normalizePart(firstName),
    last_name: normalizePart(lastName)
  };
};

// Address standardization
export const standardizeAddress = (
  address1?: string | null,
  city?: string | null,
  state?: string | null,
  zipCode?: string | null
) => {
  const result: Record<string, string | null> = {};

  // Standardize address line 1
  if (address1) {
    result.address_1 = address1.trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/\bst\b/gi, 'Street')
      .replace(/\bave\b/gi, 'Avenue')
      .replace(/\brd\b/gi, 'Road')
      .replace(/\bdr\b/gi, 'Drive')
      .replace(/\bln\b/gi, 'Lane');
  }

  // Standardize city
  if (city) {
    result.city = city.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Standardize state
  if (state) {
    const stateMap: Record<string, string> = {
      'al': 'AL', 'alabama': 'AL',
      'ak': 'AK', 'alaska': 'AK',
      'az': 'AZ', 'arizona': 'AZ',
      'ar': 'AR', 'arkansas': 'AR',
      'ca': 'CA', 'california': 'CA',
      'co': 'CO', 'colorado': 'CO',
      'ct': 'CT', 'connecticut': 'CT',
      'de': 'DE', 'delaware': 'DE',
      'fl': 'FL', 'florida': 'FL',
      'ga': 'GA', 'georgia': 'GA',
      'hi': 'HI', 'hawaii': 'HI',
      'id': 'ID', 'idaho': 'ID',
      'il': 'IL', 'illinois': 'IL',
      'in': 'IN', 'indiana': 'IN',
      'ia': 'IA', 'iowa': 'IA',
      'ks': 'KS', 'kansas': 'KS',
      'ky': 'KY', 'kentucky': 'KY',
      'la': 'LA', 'louisiana': 'LA',
      'me': 'ME', 'maine': 'ME',
      'md': 'MD', 'maryland': 'MD',
      'ma': 'MA', 'massachusetts': 'MA',
      'mi': 'MI', 'michigan': 'MI',
      'mn': 'MN', 'minnesota': 'MN',
      'ms': 'MS', 'mississippi': 'MS',
      'mo': 'MO', 'missouri': 'MO',
      'mt': 'MT', 'montana': 'MT',
      'ne': 'NE', 'nebraska': 'NE',
      'nv': 'NV', 'nevada': 'NV',
      'nh': 'NH', 'new hampshire': 'NH',
      'nj': 'NJ', 'new jersey': 'NJ',
      'nm': 'NM', 'new mexico': 'NM',
      'ny': 'NY', 'new york': 'NY',
      'nc': 'NC', 'north carolina': 'NC',
      'nd': 'ND', 'north dakota': 'ND',
      'oh': 'OH', 'ohio': 'OH',
      'ok': 'OK', 'oklahoma': 'OK',
      'or': 'OR', 'oregon': 'OR',
      'pa': 'PA', 'pennsylvania': 'PA',
      'ri': 'RI', 'rhode island': 'RI',
      'sc': 'SC', 'south carolina': 'SC',
      'sd': 'SD', 'south dakota': 'SD',
      'tn': 'TN', 'tennessee': 'TN',
      'tx': 'TX', 'texas': 'TX',
      'ut': 'UT', 'utah': 'UT',
      'vt': 'VT', 'vermont': 'VT',
      'va': 'VA', 'virginia': 'VA',
      'wa': 'WA', 'washington': 'WA',
      'wv': 'WV', 'west virginia': 'WV',
      'wi': 'WI', 'wisconsin': 'WI',
      'wy': 'WY', 'wyoming': 'WY'
    };

    const normalizedState = state.trim().toLowerCase();
    const mappedState = stateMap[normalizedState];

    if (mappedState) {
      result.state = mappedState;
    } else {
      // For invalid states, try to extract first 2 uppercase letters, or leave as-is if it's already 2 chars
      const upperState = state.toUpperCase().trim();
      if (upperState.length === 2 && /^[A-Z]{2}$/.test(upperState)) {
        result.state = upperState;
      } else if (upperState.length > 2) {
        result.state = upperState.slice(0, 2);
      } else {
        result.state = upperState;
      }
    }
  }

  // Standardize ZIP code
  if (zipCode) {
    const zipDigits = zipCode.replace(/\D/g, '');
    if (zipDigits.length === 5) {
      result.zip_code = zipDigits;
    } else if (zipDigits.length === 9) {
      result.zip_code = `${zipDigits.slice(0, 5)}-${zipDigits.slice(5)}`;
    } else if (zipDigits.length === 10 && zipDigits.includes('')) {
      result.zip_code = zipCode.trim();
    }
  }

  return result;
};

// Geographic data enrichment using ZIP codes
const zipToLocation: Record<string, { city: string; state: string; timezone: string }> = {
  // Major cities for demo - in real app, this would be comprehensive
  '10001': { city: 'New York', state: 'NY', timezone: 'Eastern' },
  '90210': { city: 'Beverly Hills', state: 'CA', timezone: 'Pacific' },
  '60601': { city: 'Chicago', state: 'IL', timezone: 'Central' },
  '77001': { city: 'Houston', state: 'TX', timezone: 'Central' },
  '33101': { city: 'Miami', state: 'FL', timezone: 'Eastern' },
  // Add more as needed
};

export const enrichFromZipCode = (zipCode?: string | null) => {
  if (!zipCode) return null;

  const cleanZip = zipCode.replace(/\D/g, '').slice(0, 5);
  return zipToLocation[cleanZip] || null;
};

// Company domain inference from email
export const inferCompanyFromEmail = (email?: string | null): string | null => {
  if (!email) return null;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Common personal email domains - these suggest no company
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'me.com', 'live.com', 'msn.com', 'comcast.net'
  ];

  if (personalDomains.includes(domain)) {
    return null;
  }

  // Extract company name from domain
  const companyName = domain.split('.')[0];
  return companyName.charAt(0).toUpperCase() + companyName.slice(1);
};

// Data quality scoring - focused on core contact information
export const calculateDataQualityScore = (contact: Contact): number => {
  let score = 0;
  let totalFields = 4; // Name, Phone, Email, Address

  // Name field (required for any contact)
  if (contact.first_name && contact.last_name) {
    score += 1;
  }

  // Phone
  if (contact.phone) {
    score += 1;
  }

  // Email
  if (contact.email) {
    score += 1;
  }

  // Address information
  if (contact.address_1 || contact.city || contact.state || contact.zip_code) {
    score += 1;
  }

  return Math.round((score / totalFields) * 100);
};

// Generate enrichment suggestions - focused on core contact fields
export const generateEnrichmentSuggestions = (contact: Contact): string[] => {
  const suggestions: string[] = [];

  if (!contact.first_name || !contact.last_name) {
    suggestions.push('Add contact name for better identification');
  }

  if (!contact.phone) {
    suggestions.push('Add phone number');
  }

  if (!contact.email) {
    suggestions.push('Add email address');
  }

  if (!contact.address_1 && !contact.city && !contact.state && !contact.zip_code) {
    suggestions.push('Add address information for location data');
  }

  return suggestions;
};

// Main enrichment function
export const enrichContact = (contact: Contact): EnrichmentResult => {
  const changes: string[] = [];
  const enriched: any = { ...contact };

  // Standardize phone
  const standardizedPhone = standardizePhone(contact.phone);
  if (standardizedPhone !== contact.phone && standardizedPhone) {
    enriched.phone = standardizedPhone;
    changes.push('Standardized phone number format');
  }

  // Standardize email
  const standardizedEmail = standardizeEmail(contact.email);
  if (standardizedEmail !== contact.email && standardizedEmail) {
    enriched.email = standardizedEmail;
    changes.push('Standardized email format');
  }

  // Normalize names
  const normalizedNames = normalizeName(contact.first_name, contact.last_name);
  if (normalizedNames.first_name !== contact.first_name) {
    enriched.first_name = normalizedNames.first_name;
    changes.push('Normalized first name format');
  }
  if (normalizedNames.last_name !== contact.last_name) {
    enriched.last_name = normalizedNames.last_name;
    changes.push('Normalized last name format');
  }

  // Standardize address
  const standardizedAddress = standardizeAddress(
    contact.address_1,
    contact.city,
    contact.state,
    contact.zip_code
  );

  Object.entries(standardizedAddress).forEach(([field, value]) => {
    if (value && value !== contact[field as keyof Contact]) {
      enriched[field] = value;
      changes.push(`Standardized ${field.replace('_', ' ')}`);
    }
  });

  // Enrich from ZIP code if location data is missing
  const zipEnrichment = enrichFromZipCode(contact.zip_code);
  if (zipEnrichment) {
    if (!contact.city && zipEnrichment.city) {
      enriched.city = zipEnrichment.city;
      changes.push('Added city from ZIP code');
    }
    if (!contact.state && zipEnrichment.state) {
      enriched.state = zipEnrichment.state;
      changes.push('Added state from ZIP code');
    }
  }

  // Infer company from email if not present
  if (!contact.tags?.some(tag => tag.toLowerCase().includes('company') || tag.toLowerCase().includes('business'))) {
    const inferredCompany = inferCompanyFromEmail(contact.email);
    if (inferredCompany) {
      enriched.tags = [...(contact.tags || []), inferredCompany];
      changes.push('Added inferred company tag from email domain');
    }
  }

  // Calculate quality score
  const qualityScore = calculateDataQualityScore(enriched);

  // Determine quality level
  let quality: 'poor' | 'fair' | 'good' | 'excellent';
  if (qualityScore >= 90) quality = 'excellent';
  else if (qualityScore >= 75) quality = 'good';
  else if (qualityScore >= 50) quality = 'fair';
  else quality = 'poor';

  const result: EnrichedContact = {
    ...enriched,
    enrichment_score: qualityScore,
    enrichment_suggestions: generateEnrichmentSuggestions(enriched),
    enriched_fields: changes.reduce((acc, change) => {
      acc[change.toLowerCase().replace(/\s+/g, '_')] = true;
      return acc;
    }, {} as Record<string, any>),
    data_quality: quality
  };

  return {
    contact: result,
    changes_made: changes,
    suggestions: result.enrichment_suggestions
  };
};

