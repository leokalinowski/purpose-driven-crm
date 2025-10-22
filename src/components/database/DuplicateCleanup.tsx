import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trash2, 
  Merge,
  Users,
  Database
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Contact } from '@/hooks/useContacts';
import { 
  normalizeContact, 
  areContactsDuplicates, 
  mergeContacts,
  NormalizedContact 
} from '@/utils/contactUtils';

interface DuplicateGroup {
  id: string;
  contacts: Contact[];
  reason: string;
  action: 'keep_first' | 'merge' | 'delete_all';
  mergedContact?: Contact;
}

interface CleanupStats {
  totalContacts: number;
  duplicateGroups: number;
  contactsToDelete: number;
  contactsToMerge: number;
  finalContactCount: number;
}

export const DuplicateCleanup: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');

  const scanForDuplicates = async () => {
    if (!user) return;
    
    setScanning(true);
    setProgress(0);
    setCurrentStage('Loading contacts...');
    
    try {
      // Load all contacts for the user
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at');

      if (error) throw error;
      
      setProgress(25);
      setCurrentStage('Normalizing contact data...');
      
      // Normalize contacts for comparison
      const normalizedContacts = contacts.map(contact => ({
        ...contact,
        ...normalizeContact(contact)
      }));
      
      setProgress(50);
      setCurrentStage('Finding duplicate groups...');
      
      // Find duplicate groups
      const groups: DuplicateGroup[] = [];
      const processed = new Set<string>();
      
      for (let i = 0; i < normalizedContacts.length; i++) {
        if (processed.has(contacts[i].id)) continue;
        
        const current = normalizedContacts[i];
        const duplicates: Contact[] = [];
        let reason = '';
        
        for (let j = i + 1; j < normalizedContacts.length; j++) {
          if (processed.has(contacts[j].id)) continue;
          
          const comparison = areContactsDuplicates(current, normalizedContacts[j]);
          if (comparison.isDuplicate) {
            duplicates.push(contacts[j]);
            processed.add(contacts[j].id);
            if (comparison.reason.length > reason.length) {
              reason = comparison.reason;
            }
          }
        }
        
        if (duplicates.length > 0) {
          groups.push({
            id: `group-${i}`,
            contacts: [contacts[i], ...duplicates],
            reason,
            action: 'keep_first'
          });
          processed.add(contacts[i].id);
        }
      }
      
      setProgress(75);
      setCurrentStage('Calculating cleanup statistics...');
      
      // Calculate stats
      const totalContacts = contacts.length;
      const duplicateGroupsCount = groups.length;
      const contactsToDelete = groups.reduce((sum, group) => sum + group.contacts.length - 1, 0);
      const finalContactCount = totalContacts - contactsToDelete;
      
      setStats({
        totalContacts,
        duplicateGroups: duplicateGroupsCount,
        contactsToDelete,
        contactsToMerge: 0,
        finalContactCount
      });
      
      setDuplicateGroups(groups);
      setProgress(100);
      setCurrentStage('Scan complete');
      
      toast({
        title: 'Scan Complete',
        description: `Found ${duplicateGroupsCount} duplicate groups affecting ${contactsToDelete} contacts`
      });
      
    } catch (error) {
      console.error('Duplicate scan error:', error);
      toast({
        title: 'Error',
        description: 'Failed to scan for duplicates',
        variant: 'destructive'
      });
    } finally {
      setScanning(false);
      setProgress(0);
      setCurrentStage('');
    }
  };

  const executeCleanup = async () => {
    if (!user || !stats) return;
    
    setLoading(true);
    setProgress(0);
    setCurrentStage('Preparing cleanup...');
    
    try {
      let processed = 0;
      const total = duplicateGroups.length;
      
      for (const group of duplicateGroups) {
        setCurrentStage(`Processing group ${processed + 1} of ${total}...`);
        
        if (group.action === 'keep_first') {
          // Keep the first contact, delete the rest
          const toDelete = group.contacts.slice(1);
          const deleteIds = toDelete.map(c => c.id);
          
          if (deleteIds.length > 0) {
            const { error } = await supabase
              .from('contacts')
              .delete()
              .in('id', deleteIds);
            
            if (error) throw error;
          }
          
        } else if (group.action === 'merge') {
          // Merge all contacts into one
          const merged = group.contacts.reduce((acc, contact) => 
            mergeContacts(acc, contact), group.contacts[0]
          );
          
          // Update the first contact with merged data
          const { error: updateError } = await supabase
            .from('contacts')
            .update(merged)
            .eq('id', group.contacts[0].id);
          
          if (updateError) throw error;
          
          // Delete the rest
          const toDelete = group.contacts.slice(1);
          const deleteIds = toDelete.map(c => c.id);
          
          if (deleteIds.length > 0) {
            const { error: deleteError } = await supabase
              .from('contacts')
              .delete()
              .in('id', deleteIds);
            
            if (deleteError) throw error;
          }
        }
        
        processed++;
        setProgress((processed / total) * 100);
      }
      
      setCurrentStage('Cleanup complete!');
      
      toast({
        title: 'Success',
        description: `Successfully cleaned up ${stats.contactsToDelete} duplicate contacts`
      });
      
      // Reset state
      setDuplicateGroups([]);
      setStats(null);
      
    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute cleanup',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setProgress(0);
      setCurrentStage('');
    }
  };

  const updateGroupAction = (groupId: string, action: DuplicateGroup['action']) => {
    setDuplicateGroups(prev => 
      prev.map(group => 
        group.id === groupId ? { ...group, action } : group
      )
    );
  };

  const calculateNewStats = () => {
    if (!stats) return;
    
    const contactsToDelete = duplicateGroups.reduce((sum, group) => {
      if (group.action === 'delete_all') return sum + group.contacts.length;
      if (group.action === 'keep_first' || group.action === 'merge') return sum + group.contacts.length - 1;
      return sum;
    }, 0);
    
    return {
      ...stats,
      contactsToDelete,
      finalContactCount: stats.totalContacts - contactsToDelete
    };
  };

  const newStats = calculateNewStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Duplicate Contact Cleanup
          </CardTitle>
          <CardDescription>
            Scan your contact database for duplicates and clean them up efficiently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={scanForDuplicates} 
            disabled={scanning || loading}
            className="w-full"
          >
            {scanning ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            {scanning ? 'Scanning for Duplicates...' : 'Scan for Duplicates'}
          </Button>
          
          {scanning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentStage}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Cleanup Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalContacts}</div>
                <div className="text-sm text-muted-foreground">Total Contacts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.duplicateGroups}</div>
                <div className="text-sm text-muted-foreground">Duplicate Groups</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{newStats.contactsToDelete}</div>
                <div className="text-sm text-muted-foreground">Contacts to Remove</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{newStats.finalContactCount}</div>
                <div className="text-sm text-muted-foreground">Final Count</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {duplicateGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Duplicate Groups</CardTitle>
            <CardDescription>
              Review and configure how to handle each duplicate group
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-96 overflow-y-auto">
            {duplicateGroups.map((group, index) => (
              <Card key={group.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">
                        Group {index + 1} - {group.contacts[0].first_name} {group.contacts[0].last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">{group.reason}</p>
                      <Badge variant="outline" className="mt-1">
                        {group.contacts.length} contacts
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {group.contacts.map((contact, i) => (
                      <div key={contact.id} className="text-sm bg-muted p-2 rounded">
                        <strong>Contact {i + 1}:</strong> {contact.email || 'No email'} | {contact.phone || 'No phone'}
                        {contact.address_1 && ` | ${contact.address_1}`}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={group.action === 'keep_first' ? 'default' : 'outline'}
                      onClick={() => updateGroupAction(group.id, 'keep_first')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Keep First
                    </Button>
                    <Button
                      size="sm"
                      variant={group.action === 'merge' ? 'default' : 'outline'}
                      onClick={() => updateGroupAction(group.id, 'merge')}
                    >
                      <Merge className="h-4 w-4 mr-1" />
                      Merge All
                    </Button>
                    <Button
                      size="sm"
                      variant={group.action === 'delete_all' ? 'destructive' : 'outline'}
                      onClick={() => updateGroupAction(group.id, 'delete_all')}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {duplicateGroups.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This action cannot be undone. Make sure you've reviewed all duplicate groups before proceeding.
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                This will remove {newStats.contactsToDelete} duplicate contacts, leaving you with {newStats.finalContactCount} unique contacts.
              </div>
              <Button 
                onClick={executeCleanup} 
                disabled={loading}
                variant="destructive"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {loading ? 'Cleaning Up...' : 'Execute Cleanup'}
              </Button>
            </div>
            
            {loading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentStage}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
