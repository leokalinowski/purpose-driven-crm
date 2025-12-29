// SphereSync Method - Balanced letter distribution for weekly contact assignments
// Based on English surname frequency analysis for more even task distribution

/**
 * Letter frequency in English surnames (approximate):
 * High frequency: S(~10%), M(~8%), B(~7%), C(~7%), H(~6%), W(~6%), L(~5%), R(~5%), T(~5%), P(~5%)
 * Medium frequency: A(~4%), D(~4%), F(~4%), G(~4%), K(~3%), N(~3%), V(~3%), J(~2%)  
 * Low frequency: E(~2%), I(~2%), O(~2%), U(~1%), Q(~0.5%), X(~0.3%), Y(~0.2%), Z(~0.1%)
 * 
 * Strategy: Mix high-frequency with low-frequency letters for balanced task loads
 * Always 2 letters for calls, 1 letter for texts per week
 */

// Balanced weekly call categories mapping (2 categories per week)
// Each pair mixes high-frequency with low-frequency letters
export const SPHERESYNC_CALLS: Record<number, string[]> = {
  // Q1 - January to March (weeks 1-13)
  1: ['S', 'Q'], 2: ['M', 'X'], 3: ['B', 'Y'], 4: ['C', 'Z'], 5: ['H', 'U'], 
  6: ['W', 'E'], 7: ['L', 'I'], 8: ['R', 'O'], 9: ['T', 'V'], 10: ['P', 'J'],
  11: ['A', 'K'], 12: ['D', 'N'], 13: ['F', 'G'],
  
  // Q2 - April to June (weeks 14-26)  
  14: ['S', 'X'], 15: ['M', 'Y'], 16: ['B', 'Z'], 17: ['C', 'U'], 18: ['H', 'E'],
  19: ['W', 'I'], 20: ['L', 'O'], 21: ['R', 'V'], 22: ['T', 'J'], 23: ['P', 'K'],
  24: ['A', 'N'], 25: ['D', 'G'], 26: ['F', 'Q'],
  
  // Q3 - July to September (weeks 27-39)
  27: ['S', 'Y'], 28: ['M', 'Z'], 29: ['B', 'U'], 30: ['C', 'E'], 31: ['H', 'I'],
  32: ['W', 'O'], 33: ['L', 'V'], 34: ['R', 'J'], 35: ['T', 'K'], 36: ['P', 'N'],
  37: ['A', 'G'], 38: ['D', 'Q'], 39: ['F', 'X'],
  
  // Q4 - October to December (weeks 40-52)
  40: ['S', 'Z'], 41: ['M', 'U'], 42: ['B', 'E'], 43: ['C', 'I'], 44: ['H', 'O'],
  45: ['W', 'V'], 46: ['L', 'J'], 47: ['R', 'K'], 48: ['T', 'N'], 49: ['P', 'G'],
  50: ['A', 'Q'], 51: ['D', 'X'], 52: ['F', 'Y']
};

// Balanced weekly text categories (1 category per week)
// Rotates through all 26 letters over the year, prioritizing high-frequency letters in peak weeks
export const SPHERESYNC_TEXTS: Record<number, string> = {
  // Q1 - Focus on medium-high frequency letters for New Year motivation
  1: 'M', 2: 'B', 3: 'C', 4: 'H', 5: 'W', 6: 'L', 7: 'R', 8: 'T', 9: 'P',
  10: 'A', 11: 'D', 12: 'F', 13: 'G',
  
  // Q2 - Spring mix with some high-frequency letters
  14: 'S', 15: 'K', 16: 'N', 17: 'V', 18: 'J', 19: 'E', 20: 'I', 21: 'O',
  22: 'U', 23: 'M', 24: 'B', 25: 'C', 26: 'H',
  
  // Q3 - Summer balance with remaining letters  
  27: 'W', 28: 'L', 29: 'R', 30: 'T', 31: 'P', 32: 'A', 33: 'D', 34: 'F',
  35: 'G', 36: 'S', 37: 'K', 38: 'N', 39: 'V',
  
  // Q4 - End of year with low-frequency letters mixed with high
  40: 'J', 41: 'E', 42: 'I', 43: 'O', 44: 'U', 45: 'Q', 46: 'X', 47: 'Y', 
  48: 'Z', 49: 'M', 50: 'B', 51: 'C', 52: 'H'
};

/**
 * Calculate ISO 8601 week number and year
 * Handles year boundaries correctly (e.g., Dec 29, 2025 = Week 1 of 2026)
 */
export function getISOWeekNumber(date: Date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNumber, year: d.getUTCFullYear() };
}

/**
 * Get the current week number (1-52) for category lookup
 * Maps ISO week to our 52-week category system
 */
export function getCurrentWeekNumber(): number {
  const { week } = getISOWeekNumber();
  // ISO weeks can be 1-53, but our category system uses 1-52
  return Math.min(week, 52);
}

/**
 * Get call categories for a given week number
 */
export function getCallCategoriesForWeek(weekNumber: number): string[] {
  return SPHERESYNC_CALLS[weekNumber] || [];
}

/**
 * Get text category for a given week number
 */
export function getTextCategoryForWeek(weekNumber: number): string {
  return SPHERESYNC_TEXTS[weekNumber] || '';
}

/**
 * Get current week's call and text categories with ISO year
 */
export function getCurrentWeekTasks() {
  const { week, year } = getISOWeekNumber();
  const weekNumber = Math.min(week, 52); // Map to our 52-week system
  return {
    weekNumber,
    isoYear: year,
    callCategories: getCallCategoriesForWeek(weekNumber),
    textCategory: getTextCategoryForWeek(weekNumber)
  };
}

/**
 * Get previous week number(s), handling year rollover
 */
export function getPreviousWeekNumber(weekNumber: number, year: number, weeksBack: number = 1): { weekNumber: number; year: number } {
  let targetWeek = weekNumber - weeksBack;
  let targetYear = year;
  
  if (targetWeek < 1) {
    // Roll back to previous year
    targetYear = year - 1;
    targetWeek = 52 + targetWeek; // Add the negative value (e.g., 52 + (-1) = 51)
  }
  
  return { weekNumber: targetWeek, year: targetYear };
}

/**
 * Get week info for current week and previous N weeks
 */
export function getWeekRange(weeksBack: number = 2): Array<{ weekNumber: number; year: number; label: string }> {
  // Use ISO week and year for consistent year boundary handling
  const { week: currentWeek, year: isoYear } = getISOWeekNumber();
  const weeks: Array<{ weekNumber: number; year: number; label: string }> = [];
  
  // Add current week
  weeks.push({
    weekNumber: Math.min(currentWeek, 52), // Map to our 52-week system
    year: isoYear,
    label: `Week ${Math.min(currentWeek, 52)} (Current)`
  });
  
  // Add previous weeks
  for (let i = 1; i <= weeksBack; i++) {
    const prevWeek = getPreviousWeekNumber(Math.min(currentWeek, 52), isoYear, i);
    weeks.push({
      weekNumber: prevWeek.weekNumber,
      year: prevWeek.year,
      label: `Week ${prevWeek.weekNumber} (${i === 1 ? '1 week ago' : `${i} weeks ago`})`
    });
  }
  
  return weeks;
}