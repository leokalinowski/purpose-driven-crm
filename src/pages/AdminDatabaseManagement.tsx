import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Upload, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ContactTable } from '@/components/database/ContactTable';
import { ContactForm } from '@/components/database/ContactForm';
import { ImprovedCSVUpload } from '@/components/database/ImprovedCSVUpload';
import { DNCStatsCard } from '@/components/database/DNCStatsCard';
import { ContactActivitiesDialog } from '@/components/database/ContactActivitiesDialog';
import { DuplicateCleanupButton } from '@/components/admin/DuplicateCleanupButton';
import { DNCCheckButton } from '@/components/database/DNCCheckButton';
import { DataQualityDashboard } from '@/components/database/DataQualityDashboard';
import { BulkContactEditor } from '@/components/database/BulkContactEditor';
import { EnrichedContact } from '@/utils/dataEnrichment';

import { Contact, ContactInput } from '@/hooks/useContacts';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useAgents } from '@/hooks/useAgents';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Custom hooks for admin database management
const useAdminContacts = (selectedAgentId?: string) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof Contact>('last_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const ITEMS_PER_PAGE = 25;
  const effectiveAgentId = selectedAgentId || user?.id;

  // Reset pagination when agent changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAgentId]);

  const fetchAllContacts = React.useCallback(async (): Promise<Contact[]> => {
    if (!user || !effectiveAgentId) return [];

    try {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('agent_id', effectiveAgentId)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(5000);

      const trimmed = debouncedSearchTerm.trim();
      if (trimmed) {
        query = query.or(
          `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as Contact[]) || [];
    } catch (error) {
      console.error('[useAdminContacts] Error fetching all contacts:', error);
      return [];
    }
  }, [user, effectiveAgentId, debouncedSearchTerm, sortBy, sortOrder]);

  const fetchContacts = React.useCallback(async () => {
    if (!user || !effectiveAgentId) {
      setContacts([]);
      setAllContacts([]);
      setTotalContacts(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('agent_id', effectiveAgentId)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE - 1,
        );

      const trimmed = debouncedSearchTerm.trim();
      if (trimmed) {
        query = query.or(
          `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setContacts((data as Contact[]) || []);
      const total = count || 0;
      setTotalContacts(total);
      setTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));

      const all = await fetchAllContacts();
      setAllContacts(all);
    } catch (error) {
      console.error('[useAdminContacts] Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    effectiveAgentId,
    debouncedSearchTerm,
    currentPage,
    sortBy,
    sortOrder,
    fetchAllContacts,
  ]);

  const addContact = async (contactData: ContactInput) => {
    if (!user || !effectiveAgentId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .insert([
        {
          ...contactData,
          agent_id: effectiveAgentId,
          category: contactData.last_name.charAt(0).toUpperCase() || 'A',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    fetchContacts();
    return data;
  };

  const updateContact = async (id: string, contactData: Partial<ContactInput>) => {
    if (!user || !effectiveAgentId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .update(contactData)
      .eq('id', id)
      .eq('agent_id', effectiveAgentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteContact = async (id: string) => {
    if (!user || !effectiveAgentId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('agent_id', effectiveAgentId);

    if (error) throw error;
  };

  const uploadCSV = async (csvData: ContactInput[]) => {
    if (!user || !effectiveAgentId) throw new Error('User not authenticated');

    const BATCH_SIZE = 100;
    const results: Contact[] = [];

    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);
      const contactsWithAgent = batch.map((contact) => ({
        ...contact,
        agent_id: effectiveAgentId,
        category: contact.last_name.charAt(0).toUpperCase() || 'A',
      }));

      const { data, error } = await supabase
        .from('contacts')
        .insert(contactsWithAgent)
        .select();

      if (error) throw error;
      results.push(...((data as Contact[]) || []));
    }

    return results;
  };

  const handleSort = (column: keyof Contact) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleSearch = React.useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);

  const goToPage = React.useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    allContacts,
    totalContacts,
    loading,
    currentPage,
    totalPages,
    searchTerm,
    sortBy,
    sortOrder,
    addContact,
    updateContact,
    deleteContact,
    uploadCSV,
    handleSort,
    handleSearch,
    goToPage,
    fetchContacts,
    fetchAllContacts,
  };
};

const useAdminDNCStats = (selectedAgentId?: string) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalContacts: 0,
    dncContacts: 0,
    nonDncContacts: 0,
    neverChecked: 0,
    missingPhone: 0,
    needsRecheck: 0,
    lastChecked: null as string | null,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const effectiveAgentId = selectedAgentId || user?.id;

  const fetchDNCStats = React.useCallback(async () => {
    if (!user || !effectiveAgentId) return;

    setLoading(true);
    try {
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId);

      const { count: dncContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .eq('dnc', true);

      const { count: neverChecked } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .is('dnc_last_checked', null)
        .not('phone', 'is', null)
        .neq('phone', '');

      const { count: missingPhone } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .or('phone.is.null,phone.eq.');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: needsRecheck } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .eq('dnc', false)
        .not('dnc_last_checked', 'is', null)
        .lt('dnc_last_checked', thirtyDaysAgo.toISOString());

      const { data: lastLog } = await supabase
        .from('dnc_logs')
        .select('run_date')
        .eq('agent_id', effectiveAgentId)
        .order('run_date', { ascending: false })
        .limit(1)
        .single();

      setStats({
        totalContacts: totalContacts || 0,
        dncContacts: dncContacts || 0,
        nonDncContacts: (totalContacts || 0) - (dncContacts || 0),
        neverChecked: neverChecked || 0,
        missingPhone: missingPhone || 0,
        needsRecheck: needsRecheck || 0,
        lastChecked: lastLog?.run_date || null,
      });
    } catch (error) {
      console.error('Error fetching DNC stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, effectiveAgentId]);

  const triggerDNCCheck = React.useCallback(async (forceRecheck: boolean = false) => {
    if (!user || !effectiveAgentId) {
      throw new Error('User not authenticated');
    }

    console.log('[Admin DNC Check] Starting check:', {
      agentId: effectiveAgentId,
      forceRecheck,
      isCurrentUser: effectiveAgentId === user.id
    });

    setChecking(true);
    try {
      const body: any = {
        manualTrigger: true,
        forceRecheck,
        agentId: effectiveAgentId // Always pass agentId explicitly
      };

      console.log('[Admin DNC Check] Calling edge function with body:', body);

      const { data, error } = await supabase.functions.invoke('dnc-monthly-check', {
        body
      });

      if (error) {
        console.error('[Admin DNC Check] Edge function error:', error);
        throw new Error(error.message || 'Failed to trigger DNC check');
      }

      console.log('[Admin DNC Check] Edge function response:', data);

      // Wait a moment for the database to update, then refresh stats
      console.log('[Admin DNC Check] Waiting for database update...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time

      console.log('[Admin DNC Check] Refreshing DNC stats...');
      await fetchDNCStats();

      console.log('[Admin DNC Check] Stats refreshed successfully');
      return data;
    } catch (error) {
      console.error('[Admin DNC Check] Failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger DNC check';
      throw new Error(errorMessage);
    } finally {
      setChecking(false);
    }
  }, [user, effectiveAgentId, fetchDNCStats]);

  useEffect(() => {
    fetchDNCStats();
  }, [effectiveAgentId, fetchDNCStats]);

  // Auto-refresh DNC stats every 30 seconds when checking is active
  React.useEffect(() => {
    if (checking) {
      console.log('[Admin DNC Stats] Starting auto-refresh polling...');
      const interval = setInterval(() => {
        console.log('[Admin DNC Stats] Auto-refreshing stats...');
        fetchDNCStats();
      }, 30000); // Every 30 seconds

      return () => {
        console.log('[Admin DNC Stats] Stopping auto-refresh polling');
        clearInterval(interval);
      };
    }
  }, [checking, fetchDNCStats]);

  return {
    stats,
    loading,
    checking,
    fetchDNCStats,
    triggerDNCCheck,
  };
};

const AdminDatabaseManagement = () => {
  const [selectedViewingAgent, setSelectedViewingAgent] = useState<string>('');

  const {
    contacts,
    allContacts,
    totalContacts,
    loading,
    currentPage,
    totalPages,
    searchTerm,
    sortBy,
    sortOrder,
    addContact,
    updateContact,
    deleteContact,
    uploadCSV,
    handleSort,
    handleSearch,
    goToPage,
    fetchContacts,
  } = useAdminContacts(selectedViewingAgent);

  const {
    stats,
    loading: dncLoading,
    checking: dncChecking,
    fetchDNCStats,
    triggerDNCCheck,
  } = useAdminDNCStats(selectedViewingAgent);

  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const { agents, fetchAgents, getAgentDisplayName } = useAgents();
  const { generateTasksForNewContacts } = useSphereSyncTasks();

  // Prevent scrolling to top when search changes
  const scrollPositionRef = React.useRef<number>(0);

  const handleSearchNoScroll = React.useCallback((term: string) => {
    scrollPositionRef.current = window.scrollY;
    handleSearch(term);
  }, [handleSearch]);

  // Restore scroll position after search results load
  React.useEffect(() => {
    if (!loading && scrollPositionRef.current > 0) {
      const timeoutId = setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
        scrollPositionRef.current = 0;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [loading]);

  const [showContactForm, setShowContactForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [viewingTouchpointsContact, setViewingTouchpointsContact] = useState<Contact | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [showBulkEditor, setShowBulkEditor] = useState(false);

  // Fetch agents for admin selector
  useEffect(() => {
    if (isAdmin) {
      fetchAgents();
    }
  }, [isAdmin, fetchAgents]);

  // Reset search and pagination when switching agents
  useEffect(() => {
    handleSearch('');
    goToPage(1);
  }, [selectedViewingAgent, handleSearch, goToPage]);

  const handleAddContact = async (contactData: ContactInput) => {
    try {
      await addContact(contactData);
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      setShowContactForm(false);
      await fetchDNCStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive",
      });
    }
  };

  const handleEditContact = async (contactData: Partial<ContactInput>) => {
    if (!editingContact) return;

    try {
      await updateContact(editingContact.id, contactData);
      await fetchContacts(); // Refresh UI to show updated data
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      closeContactForm();
      await fetchDNCStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;

    try {
      await deleteContact(deletingContact.id);
      setDeletingContact(null);
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      await fetchDNCStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  const handleContactEnriched = async (enrichedContact: EnrichedContact) => {
    try {
      const contactInput: ContactInput = {
        first_name: enrichedContact.first_name,
        last_name: enrichedContact.last_name,
        phone: enrichedContact.phone,
        email: enrichedContact.email,
        address_1: enrichedContact.address_1,
        address_2: enrichedContact.address_2,
        city: enrichedContact.city,
        state: enrichedContact.state,
        zip_code: enrichedContact.zip_code,
        tags: enrichedContact.tags,
        dnc: enrichedContact.dnc,
        notes: enrichedContact.notes,
      };

      await updateContact(enrichedContact.id, contactInput);
      await fetchContacts();

      toast({
        title: "Contact Updated",
        description: "Contact data has been enriched and saved.",
      });
    } catch (error) {
      console.error('Error updating enriched contact:', error);
      toast({
        title: "Error",
        description: "Failed to save enriched contact data.",
        variant: "destructive",
      });
    }
  };

  const handleBulkContactsEnriched = async (enrichedContacts: EnrichedContact[]) => {
    try {
      const updatePromises = enrichedContacts.map(async (enrichedContact) => {
        const contactInput: ContactInput = {
          first_name: enrichedContact.first_name,
          last_name: enrichedContact.last_name,
          phone: enrichedContact.phone,
          email: enrichedContact.email,
          address_1: enrichedContact.address_1,
          address_2: enrichedContact.address_2,
          city: enrichedContact.city,
          state: enrichedContact.state,
          zip_code: enrichedContact.zip_code,
          tags: enrichedContact.tags,
          dnc: enrichedContact.dnc,
          notes: enrichedContact.notes,
        };

        return updateContact(enrichedContact.id, contactInput);
      });

      await Promise.all(updatePromises);
      await fetchContacts();

      toast({
        title: "Bulk Update Complete",
        description: `${enrichedContacts.length} contacts have been enriched and saved.`,
      });
    } catch (error) {
      console.error('Error updating bulk enriched contacts:', error);
      toast({
        title: "Error",
        description: "Failed to save some enriched contact data.",
        variant: "destructive",
      });
    }
  };

  const handleBulkUpdate = async (updates: Partial<Contact>, contactIds: string[]) => {
    try {
      // Update all selected contacts with the same changes
      const updatePromises = contactIds.map(contactId =>
        updateContact(contactId, updates)
      );

      await Promise.all(updatePromises);
      await fetchContacts();
      await fetchDNCStats();

      setSelectedContacts([]); // Clear selection after update
    } catch (error) {
      console.error('Bulk update error:', error);
      throw error;
    }
  };

  const handleCSVUpload = async (csvData: ContactInput[]) => {
    try {
      const effectiveAgentId = selectedViewingAgent || user?.id;

      // Step 1: Upload contacts first (NO DNC checks during upload)
      let insertedContacts: Contact[] = [];
      
      if (isAdmin && selectedViewingAgent && selectedViewingAgent !== user?.id) {
        // For admin uploading to another agent, use direct insert to skip DNC checks
        const BATCH_SIZE = 100;
        for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
          const batch = csvData.slice(i, i + BATCH_SIZE);
          const contactsWithAgent = batch.map((contact) => ({
            ...contact,
            agent_id: selectedViewingAgent,
            category: contact.last_name.charAt(0).toUpperCase() || 'A',
          }));

          const { data, error } = await supabase
            .from('contacts')
            .insert(contactsWithAgent)
            .select();

          if (error) throw error;
          insertedContacts.push(...((data as Contact[]) || []));
        }
      } else {
        // For regular agent uploads, use uploadCSV
        insertedContacts = await uploadCSV(csvData);
      }

      toast({
        title: 'Success',
        description: `${insertedContacts.length} contacts uploaded successfully. DNC checks will run separately.`,
      });

      // Step 2: Generate tasks for new contacts
      await generateTasksForNewContacts(insertedContacts);

      // Step 3: Refresh data
      setShowCSVUpload(false);
      goToPage(1);
      await fetchContacts();
      await fetchDNCStats();

      // Step 4: Trigger DNC check separately AFTER upload completes
      // Use the proper triggerDNCCheck function to ensure it works correctly
      if (effectiveAgentId) {
        try {
          await triggerDNCCheck(false);
          toast({
            title: 'DNC Check Started',
            description: 'DNC check is running in the background. Contacts will be updated shortly.',
          });
        } catch (dncError: any) {
          console.error('DNC check failed:', dncError);
          toast({
            title: 'DNC Check Failed',
            description: dncError?.message || 'Failed to start DNC check. You can run it manually using the button above.',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      console.error('CSV Upload error:', error);

      let errorMessage = 'Failed to upload contacts';
      if (error?.message?.includes('Duplicate contacts found')) {
        errorMessage = error.message;
      } else if (error?.message?.includes('duplicate key value')) {
        errorMessage = 'Some contacts already exist in the database. Please check for duplicates and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setShowCSVUpload(false);
    }
  };

  const openEditForm = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const closeContactForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
  };

  // Fetch DNC stats when component mounts
  useEffect(() => {
    fetchDNCStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  const getViewingAgentName = (userId: string) => {
    if (!userId) return '';
    const agent = agents.find(a => a.user_id === userId);
    return agent ? getAgentDisplayName(agent) : 'Unknown Agent';
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Admin access required for database management.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Database Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {selectedViewingAgent
                ? `Managing ${getViewingAgentName(selectedViewingAgent)}'s contact database and compliance tools`
                : 'Select an agent to access their complete database management suite'
              }
            </p>
            {selectedViewingAgent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedViewingAgent('')}
                className="mt-1 h-7 text-xs"
              >
                Clear Selection
              </Button>
            )}
          </div>

          {/* Admin Viewing Agent Selector */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedViewingAgent} onValueChange={setSelectedViewingAgent}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select agent to manage" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.user_id} value={agent.user_id}>
                    {getAgentDisplayName(agent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 self-start sm:self-auto">
            {selectedViewingAgent && (
              <DuplicateCleanupButton
                agentId={selectedViewingAgent}
                agentName={getAgentDisplayName(agents.find(a => a.user_id === selectedViewingAgent)!)}
                onCleanupComplete={() => {
                  fetchContacts();
                }}
              />
            )}

            <Button
              onClick={() => setShowCSVUpload(true)}
              variant="outline"
              disabled={!selectedViewingAgent}
              title="Upload multiple contacts from a CSV file"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <Button
              onClick={() => setShowContactForm(true)}
              disabled={!selectedViewingAgent}
              title="Add a single contact manually"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
            <Button
              onClick={() => setShowBulkEditor(true)}
              disabled={!selectedViewingAgent || selectedContacts.length === 0}
              variant="outline"
              title="Edit multiple selected contacts at once"
            >
              <Users className="h-4 w-4 mr-2" />
              Bulk Edit ({selectedContacts.length})
            </Button>
          </div>
        </div>

        {/* Show message if no agent selected */}
        {!selectedViewingAgent ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select an Agent to Manage</h3>
                <p className="text-muted-foreground mb-4">
                  Choose an agent from the dropdown above to access their complete database management tools.
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• View and manage all contacts</p>
                  <p>• Monitor DNC compliance status</p>
                  <p>• Upload bulk contacts via CSV</p>
                  <p>• Remove duplicate entries</p>
                  <p>• Enrich contact data quality</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* DNC Statistics Dashboard */}
            <div className="space-y-4">
              <DNCStatsCard stats={stats} loading={dncLoading} />

              {/* DNC Check Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <div className="text-center">
                  <DNCCheckButton 
                    variant="default" 
                    size="lg" 
                    onRun={async (forceRecheck) => {
                      try {
                        await triggerDNCCheck(forceRecheck);
                        toast({
                          title: 'DNC Check Started',
                          description: forceRecheck 
                            ? 'Rechecking all contacts against DNC lists. This may take a few minutes.'
                            : 'Checking new contacts against DNC lists. This may take a few minutes.',
                        });
                        // Refresh stats after a delay
                        setTimeout(() => {
                          fetchDNCStats();
                        }, 5000);
                      } catch (error: any) {
                        console.error('DNC check failed:', error);
                        toast({
                          title: 'DNC Check Failed',
                          description: error?.message || 'Failed to start DNC check. Please try again.',
                          variant: 'destructive',
                        });
                      }
                    }}
                    checking={dncChecking}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Check new contacts only</p>
                </div>
                <div className="text-center">
                  <DNCCheckButton 
                    variant="destructive" 
                    size="lg" 
                    forceRecheck={true}
                    onRun={async (forceRecheck) => {
                      try {
                        await triggerDNCCheck(forceRecheck);
                        toast({
                          title: 'DNC Check Started',
                          description: 'Rechecking all contacts against DNC lists. This may take a few minutes.',
                        });
                        // Refresh stats after a delay
                        setTimeout(() => {
                          fetchDNCStats();
                        }, 5000);
                      } catch (error: any) {
                        console.error('DNC check failed:', error);
                        toast({
                          title: 'DNC Check Failed',
                          description: error?.message || 'Failed to start DNC check. Please try again.',
                          variant: 'destructive',
                        });
                      }
                    }}
                    checking={dncChecking}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Recheck all contacts</p>
                </div>
              </div>
            </div>

            {/* Data Quality Dashboard */}
            <DataQualityDashboard
              contacts={allContacts}
              onBulkEnriched={handleBulkContactsEnriched}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Contacts</span>
                  <Badge variant="secondary">{totalContacts} contacts</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => handleSearchNoScroll(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                {loading ? (
                  <div className="text-center py-8">Loading contacts...</div>
                ) : (
                  <>
                    <div className="w-full overflow-x-auto">
                      <ContactTable
                        contacts={contacts}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        onOpenEdit={openEditForm}
                        onDelete={setDeletingContact}
                        onViewActivities={setViewingTouchpointsContact}
                        onEnriched={handleContactEnriched}
                        showSelection={true}
                        selectedContacts={selectedContacts}
                        onSelectionChange={setSelectedContacts}
                      />
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>

                          {generatePageNumbers().map((page) => (
                            <Button
                              key={page}
                              variant={page === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => goToPage(page)}
                              className="min-w-[2.5rem]"
                            >
                              {page}
                            </Button>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <ContactForm
          open={showContactForm}
          onOpenChange={closeContactForm}
          contact={editingContact}
          onSubmit={editingContact ? handleEditContact : handleAddContact}
          title={editingContact ? "Edit Contact" : "Add New Contact"}
        />

        {selectedViewingAgent && showCSVUpload && (
          <ImprovedCSVUpload
            open={showCSVUpload}
            onOpenChange={setShowCSVUpload}
            onUpload={handleCSVUpload}
            agentId={selectedViewingAgent}
          />
        )}


        {/* Contact Touchpoints Dialog */}
        {viewingTouchpointsContact && (
          <ContactActivitiesDialog
            open={!!viewingTouchpointsContact}
            onOpenChange={() => setViewingTouchpointsContact(null)}
            contact={viewingTouchpointsContact}
          />
        )}

        <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingContact?.first_name} {deletingContact?.last_name}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContact} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BulkContactEditor
          open={showBulkEditor}
          onOpenChange={setShowBulkEditor}
          selectedContacts={selectedContacts}
          onBulkUpdate={handleBulkUpdate}
        />
      </div>
    </Layout>
  );
};

export default AdminDatabaseManagement;
