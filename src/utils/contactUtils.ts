/**
 * Contact utilities for data normalization, validation, and duplicate detection
 */

export interface ContactInput {
  first_name?: string;
  last_name: string;
  phone?: string;
  email?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  tags?: string[] | null;
  dnc?: boolean;
  notes?: string;
}

export interface NormalizedContact extends ContactInput {
  normalized_phone?: string;
  normalized_email?: string;
  normalized_name?: string;
  duplicate_score?: number;
  is_duplicate?: boolean;
  duplicate_of?: string;
}

/**
 * Normalize phone number to standard format
 * Handles multi-number cells by extracting the FIRST valid phone number
 * Examples:
 *   "Cell: 555-123-4567 / Work: 555-987-6543" → "5551234567"
 *   "(555) 123-4567 mobile" → "5551234567"
 *   "5551234567 5559876543" → "5551234567"
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Find sequences that look like phone numbers (digits with optional separators)
  // Match patterns like: 555-123-4567, (555) 123-4567, 555.123.4567, 5551234567
  const phonePatterns = phone.match(/\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}/g);
  
  if (phonePatterns && phonePatterns.length > 0) {
    // Take the first match and extract digits
    const digits = phonePatterns[0].replace(/\D/g, '');
    
    if (digits.length === 10) {
      return digits;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return digits.substring(1);
    }
  }
  
  // Fallback: extract all digits and take first 10 if there are enough
  const allDigits = phone.replace(/\D/g, '');
  
  if (allDigits.length >= 11 && allDigits.startsWith('1')) {
    return allDigits.substring(1, 11);
  } else if (allDigits.length >= 10) {
    return allDigits.substring(0, 10);
  } else if (allDigits.length >= 7) {
    return allDigits; // Return shorter numbers as-is (local numbers)
  }
  
  return null;
}

/**
 * Normalize email address
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  return email.trim().toLowerCase();
}

/**
 * Normalize name for comparison
 */
export function normalizeName(firstName?: string, lastName?: string): string {
  const first = (firstName || '').trim().toLowerCase();
  const last = (lastName || '').trim().toLowerCase();
  return `${first} ${last}`.trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // Levenshtein distance-based similarity
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Normalize contact data for duplicate detection
 */
export function normalizeContact(contact: ContactInput): NormalizedContact {
  return {
    ...contact,
    normalized_phone: normalizePhone(contact.phone),
    normalized_email: normalizeEmail(contact.email),
    normalized_name: normalizeName(contact.first_name, contact.last_name),
  };
}

/**
 * Check if two contacts are duplicates based on multiple criteria
 */
export function areContactsDuplicates(
  contact1: NormalizedContact, 
  contact2: NormalizedContact,
  thresholds = {
    phoneMatch: 0.9,
    emailMatch: 0.9,
    nameMatch: 0.8,
    addressMatch: 0.7
  }
): { isDuplicate: boolean; score: number; reason: string } {
  let score = 0;
  let reasons: string[] = [];
  
  // Phone number match (highest priority)
  if (contact1.normalized_phone && contact2.normalized_phone) {
    if (contact1.normalized_phone === contact2.normalized_phone) {
      score += 0.4;
      reasons.push('exact phone match');
    }
  }
  
  // Email match (high priority)
  if (contact1.normalized_email && contact2.normalized_email) {
    if (contact1.normalized_email === contact2.normalized_email) {
      score += 0.4;
      reasons.push('exact email match');
    }
  }
  
  // Name similarity
  if (contact1.normalized_name && contact2.normalized_name) {
    const nameSimilarity = calculateSimilarity(contact1.normalized_name, contact2.normalized_name);
    if (nameSimilarity >= thresholds.nameMatch) {
      score += nameSimilarity * 0.2;
      reasons.push(`name similarity: ${Math.round(nameSimilarity * 100)}%`);
    }
  }
  
  // Address similarity (if both have addresses)
  if (contact1.address_1 && contact2.address_1) {
    const address1 = `${contact1.address_1} ${contact1.city || ''} ${contact1.state || ''}`.trim();
    const address2 = `${contact2.address_1} ${contact2.city || ''} ${contact2.state || ''}`.trim();
    
    if (address1 && address2) {
      const addressSimilarity = calculateSimilarity(address1, address2);
      if (addressSimilarity >= thresholds.addressMatch) {
        score += addressSimilarity * 0.1;
        reasons.push(`address similarity: ${Math.round(addressSimilarity * 100)}%`);
      }
    }
  }
  
  const isDuplicate = score >= 0.5; // Threshold for considering duplicates
  
  return {
    isDuplicate,
    score,
    reason: reasons.join(', ') || 'no significant matches'
  };
}

/**
 * Find duplicates within a list of contacts
 */
export function findDuplicatesInList(contacts: ContactInput[]): {
  unique: ContactInput[];
  duplicates: Array<{
    original: ContactInput;
    duplicates: ContactInput[];
    reason: string;
  }>;
} {
  const normalized = contacts.map(normalizeContact);
  const unique: ContactInput[] = [];
  const duplicates: Array<{
    original: ContactInput;
    duplicates: ContactInput[];
    reason: string;
  }> = [];
  
  const processed = new Set<number>();
  
  for (let i = 0; i < normalized.length; i++) {
    if (processed.has(i)) continue;
    
    const current = normalized[i];
    const currentDuplicates: ContactInput[] = [];
    let bestReason = '';
    
    for (let j = i + 1; j < normalized.length; j++) {
      if (processed.has(j)) continue;
      
      const comparison = areContactsDuplicates(current, normalized[j]);
      if (comparison.isDuplicate) {
        currentDuplicates.push(contacts[j]);
        processed.add(j);
        if (comparison.reason.length > bestReason.length) {
          bestReason = comparison.reason;
        }
      }
    }
    
    if (currentDuplicates.length > 0) {
      duplicates.push({
        original: contacts[i],
        duplicates: currentDuplicates,
        reason: bestReason
      });
      processed.add(i);
    } else {
      unique.push(contacts[i]);
    }
  }
  
  return { unique, duplicates };
}

/**
 * Merge duplicate contacts intelligently
 */
export function mergeContacts(original: ContactInput, duplicate: ContactInput): ContactInput {
  return {
    first_name: original.first_name || duplicate.first_name,
    last_name: original.last_name || duplicate.last_name,
    phone: original.phone || duplicate.phone,
    email: original.email || duplicate.email,
    address_1: original.address_1 || duplicate.address_1,
    address_2: original.address_2 || duplicate.address_2,
    city: original.city || duplicate.city,
    state: original.state || duplicate.state,
    zip_code: original.zip_code || duplicate.zip_code,
    tags: [...(original.tags || []), ...(duplicate.tags || [])].filter((tag, index, arr) => arr.indexOf(tag) === index),
    dnc: original.dnc || duplicate.dnc,
    notes: [original.notes, duplicate.notes].filter(Boolean).join(' | ')
  };
}

/**
 * Validate contact data
 */
export function validateContact(contact: ContactInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!contact.last_name?.trim()) {
    errors.push('Last name is required');
  }
  
  if (contact.email && !isValidEmail(contact.email)) {
    errors.push('Invalid email format');
  }
  
  if (contact.phone && !isValidPhone(contact.phone)) {
    errors.push('Invalid phone format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (lenient - uses normalizePhone to extract first valid number)
 * This allows local numbers, US numbers, international formats, multi-number cells, etc.
 * Contacts with partial/invalid phones will simply skip DNC checking later.
 */
function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized !== null && normalized.length >= 7;
}
