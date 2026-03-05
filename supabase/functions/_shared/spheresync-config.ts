// Shared SphereSync letter mapping configuration
// Single source of truth for edge functions (frontend has its own copy in src/utils/sphereSyncLogic.ts)

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
export const SPHERESYNC_TEXTS: Record<number, string> = {
  // Q1
  1: 'M', 2: 'B', 3: 'C', 4: 'H', 5: 'W', 6: 'L', 7: 'R', 8: 'T', 9: 'P',
  10: 'A', 11: 'D', 12: 'F', 13: 'G',
  
  // Q2
  14: 'S', 15: 'K', 16: 'N', 17: 'V', 18: 'J', 19: 'E', 20: 'I', 21: 'O',
  22: 'U', 23: 'M', 24: 'B', 25: 'C', 26: 'H',
  
  // Q3
  27: 'W', 28: 'L', 29: 'R', 30: 'T', 31: 'P', 32: 'A', 33: 'D', 34: 'F',
  35: 'G', 36: 'S', 37: 'K', 38: 'N', 39: 'V',
  
  // Q4
  40: 'J', 41: 'E', 42: 'I', 43: 'O', 44: 'U', 45: 'Q', 46: 'X', 47: 'Y', 
  48: 'Z', 49: 'M', 50: 'B', 51: 'C', 52: 'H'
};

/**
 * Calculate ISO 8601 week number and year
 */
export function getISOWeekNumber(date: Date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNumber, year: d.getUTCFullYear() };
}

/**
 * Get current week's call and text categories
 */
export function getCurrentWeekTasks(referenceDate?: Date) {
  const { week, year } = getISOWeekNumber(referenceDate);
  const weekNumber = Math.min(week, 52);
  return {
    weekNumber,
    isoYear: year,
    callCategories: SPHERESYNC_CALLS[weekNumber] || [],
    textCategory: SPHERESYNC_TEXTS[weekNumber] || ''
  };
}
