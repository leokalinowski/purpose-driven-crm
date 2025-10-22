import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Phone, MessageSquare } from 'lucide-react';
import { getCurrentWeekTasks } from '@/utils/sphereSyncLogic';

interface UpcomingTasksPreviewProps {
  contacts: Array<{ id: string; last_name: string; category: string }>;
  weeksAhead?: number;
}

export const UpcomingTasksPreview: React.FC<UpcomingTasksPreviewProps> = ({ 
  contacts, 
  weeksAhead = 4 
}) => {
  const currentWeek = getCurrentWeekTasks();
  
  // Generate preview for next few weeks
  const upcomingWeeks = [];
  for (let i = 1; i <= weeksAhead; i++) {
    const weekNumber = currentWeek.weekNumber + i;
    const adjustedWeek = weekNumber > 52 ? weekNumber - 52 : weekNumber;
    
    // Get categories for this week
    const callCategories = getCallCategoriesForWeek(adjustedWeek);
    const textCategory = getTextCategoryForWeek(adjustedWeek);
    
    // Count contacts that would get tasks
    const callContacts = contacts.filter(contact => 
      callCategories.includes(contact.category)
    );
    const textContacts = contacts.filter(contact => 
      contact.category === textCategory
    );
    
    upcomingWeeks.push({
      weekNumber: adjustedWeek,
      callCategories,
      textCategory,
      callContacts: callContacts.length,
      textContacts: textContacts.length,
      totalTasks: callContacts.length + textContacts.length
    });
  }
  
  // Helper functions (simplified versions of the ones in sphereSyncLogic.ts)
  function getCallCategoriesForWeek(weekNumber: number): string[] {
    const SPHERESYNC_CALLS: Record<number, string[]> = {
      1: ['S', 'Q'], 2: ['M', 'X'], 3: ['B', 'Y'], 4: ['C', 'Z'], 5: ['H', 'U'], 
      6: ['W', 'E'], 7: ['L', 'I'], 8: ['R', 'O'], 9: ['T', 'V'], 10: ['P', 'J'],
      11: ['A', 'K'], 12: ['D', 'N'], 13: ['F', 'G'],
      14: ['S', 'X'], 15: ['M', 'Y'], 16: ['B', 'Z'], 17: ['C', 'U'], 18: ['H', 'E'],
      19: ['W', 'I'], 20: ['L', 'O'], 21: ['R', 'V'], 22: ['T', 'J'], 23: ['P', 'K'],
      24: ['A', 'N'], 25: ['D', 'G'], 26: ['F', 'Q'],
      27: ['S', 'Y'], 28: ['M', 'Z'], 29: ['B', 'U'], 30: ['C', 'E'], 31: ['H', 'I'],
      32: ['W', 'O'], 33: ['L', 'V'], 34: ['R', 'J'], 35: ['T', 'K'], 36: ['P', 'N'],
      37: ['A', 'G'], 38: ['D', 'Q'], 39: ['F', 'X'],
      40: ['S', 'Z'], 41: ['M', 'U'], 42: ['B', 'E'], 43: ['C', 'I'], 44: ['H', 'O'],
      45: ['W', 'V'], 46: ['L', 'J'], 47: ['R', 'K'], 48: ['T', 'N'], 49: ['P', 'G'],
      50: ['A', 'Q'], 51: ['D', 'X'], 52: ['F', 'Y']
    };
    return SPHERESYNC_CALLS[weekNumber] || [];
  }
  
  function getTextCategoryForWeek(weekNumber: number): string {
    const SPHERESYNC_TEXTS: Record<number, string> = {
      1: 'M', 2: 'B', 3: 'C', 4: 'H', 5: 'W', 6: 'L', 7: 'R', 8: 'T', 9: 'P',
      10: 'A', 11: 'D', 12: 'F', 13: 'G',
      14: 'S', 15: 'K', 16: 'N', 17: 'V', 18: 'J', 19: 'E', 20: 'I', 21: 'O',
      22: 'U', 23: 'M', 24: 'B', 25: 'C', 26: 'H',
      27: 'W', 28: 'L', 29: 'R', 30: 'T', 31: 'P', 32: 'A', 33: 'D', 34: 'F',
      35: 'G', 36: 'S', 37: 'K', 38: 'N', 39: 'V',
      40: 'J', 41: 'E', 42: 'I', 43: 'O', 44: 'U', 45: 'Q', 46: 'X', 47: 'Y', 
      48: 'Z', 49: 'M', 50: 'B', 51: 'C', 52: 'H'
    };
    return SPHERESYNC_TEXTS[weekNumber] || '';
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Tasks Preview
        </CardTitle>
        <CardDescription>
          Preview of tasks that will be generated for your contacts in the coming weeks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingWeeks.map((week, index) => (
            <div key={week.weekNumber} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline">Week {week.weekNumber}</Badge>
                <div className="text-sm">
                  <span className="font-medium">Calls:</span> {week.callCategories.join(', ')} | 
                  <span className="font-medium ml-2">Texts:</span> {week.textCategory}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {week.callContacts}
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {week.textContacts}
                </div>
                <div className="font-medium">
                  {week.totalTasks} total
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {upcomingWeeks.every(week => week.totalTasks === 0) && (
          <div className="text-center py-4 text-muted-foreground">
            <p>No tasks scheduled for the next {weeksAhead} weeks based on your current contacts.</p>
            <p className="text-sm">Upload more contacts to see upcoming task previews.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
