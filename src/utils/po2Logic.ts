// PO2 Method logic for weekly call and text assignments

// Weekly call categories mapping (2 categories per week)
export const WEEKLY_CALLS: Record<number, string[]> = {
  1: ['A', 'W'], 2: ['B', 'E'], 3: ['D', 'O'], 4: ['H', 'V'], 5: ['C', 'K'],
  6: ['F', 'G'], 7: ['M', 'X'], 8: ['N', 'R'], 9: ['S', 'U'], 10: ['P', 'L'],
  11: ['T', 'J'], 12: ['I', 'Q'], 13: ['Y', 'Z'], 14: ['A', 'W'], 15: ['B', 'E'],
  16: ['D', 'O'], 17: ['H', 'V'], 18: ['C', 'K'], 19: ['F', 'G'], 20: ['M', 'X'],
  21: ['N', 'R'], 22: ['S', 'U'], 23: ['P', 'L'], 24: ['T', 'J'], 25: ['I', 'Q'],
  26: ['Y', 'Z'], 27: ['A', 'W'], 28: ['B', 'E'], 29: ['D', 'O'], 30: ['H', 'V'],
  31: ['C', 'K'], 32: ['F', 'G'], 33: ['M', 'X'], 34: ['N', 'R'], 35: ['S', 'U'],
  36: ['P', 'L'], 37: ['T', 'J'], 38: ['I', 'Q'], 39: ['Y', 'Z'], 40: ['A', 'W'],
  41: ['B', 'E'], 42: ['D', 'O'], 43: ['H', 'V'], 44: ['C', 'K'], 45: ['F', 'G'],
  46: ['M', 'X'], 47: ['N', 'R'], 48: ['S', 'U'], 49: ['P', 'L'], 50: ['T', 'J'],
  51: ['I', 'Q'], 52: ['Y', 'Z']
};

// Weekly text categories mapping (1 category per week, 26-week cycle)
export const WEEKLY_TEXTS: Record<number, string> = {
  1: 'N', 2: 'S', 3: 'P', 4: 'T', 5: 'I', 6: 'Y', 7: 'X', 8: 'A', 9: 'B',
  10: 'D', 11: 'H', 12: 'C', 13: 'F', 14: 'R', 15: 'U', 16: 'L', 17: 'J',
  18: 'Q', 19: 'Z', 20: 'W', 21: 'E', 22: 'O', 23: 'V', 24: 'K', 25: 'G',
  26: 'M', 27: 'N', 28: 'S', 29: 'P', 30: 'T', 31: 'I', 32: 'Y', 33: 'X',
  34: 'A', 35: 'B', 36: 'D', 37: 'H', 38: 'C', 39: 'F', 40: 'R', 41: 'U',
  42: 'L', 43: 'J', 44: 'Q', 45: 'Z', 46: 'W', 47: 'E', 48: 'O', 49: 'V',
  50: 'K', 51: 'G', 52: 'M'
};

/**
 * Calculate the current week number of the year (1-52)
 */
export function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNumber = Math.ceil(diff / oneWeek);
  
  // Ensure we stay within 1-52 range
  return Math.min(Math.max(weekNumber, 1), 52);
}

/**
 * Get call categories for a given week number
 */
export function getCallCategoriesForWeek(weekNumber: number): string[] {
  return WEEKLY_CALLS[weekNumber] || [];
}

/**
 * Get text category for a given week number
 */
export function getTextCategoryForWeek(weekNumber: number): string {
  return WEEKLY_TEXTS[weekNumber] || '';
}

/**
 * Get current week's call and text categories
 */
export function getCurrentWeekTasks() {
  const weekNumber = getCurrentWeekNumber();
  return {
    weekNumber,
    callCategories: getCallCategoriesForWeek(weekNumber),
    textCategory: getTextCategoryForWeek(weekNumber)
  };
}