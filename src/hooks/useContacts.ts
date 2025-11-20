import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Contact {
  id: string;
  agent_id: string;
  first_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  address_1: string | null;
  address_2: string | null;
  zip_code: string | null;
  state: string | null;
  city: string | null;
  tags: string[] | null;
  dnc: boolean;
  dnc_last_checked: string | null;
  notes: string | null;
  category: string;
  last_activity_date: string | null;
  activity_count: number;
  created_at: string;
  updated_at: string;
}

export type ContactInput = Omit<
  Contact,
  | 'id'
  | 'agent_id'
  | 'category'
  | 'created_at'
  | 'updated_at'
  | 'dnc_last_checked'
  | 'last_activity_date'
  | 'activity_count'
>;

export const useContacts = (viewingAgentId?: string) => {
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

  // Reset search and pagination when viewing agent changes
  useEffect(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
  }, [viewingAgentId]);

  // Use viewingAgentId if provided (admin viewing another agent), otherwise use logged-in user
  const effectiveAgentId = viewingAgentId || user?.id;

  const fetchAllContacts = useCallback(async (): Promise<Contact[]> => {
    if (!user || !effectiveAgentId) return [];

    try {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('agent_id', effectiveAgentId)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(5000); // safety cap

      const trimmed = debouncedSearchTerm.trim();
      if (trimmed) {
        query = query.or(
          [
            `first_name.ilike.%${trimmed}%`,
            `last_name.ilike.%${trimmed}%`,
            `email.ilike.%${trimmed}%`,
            `phone.ilike.%${trimmed}%`,
          ].join(','),
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as Contact[]) || [];
    } catch (error) {
      console.error('[useContacts] Error fetching all contacts:', error);
      return [];
    }
  }, [user, effectiveAgentId, debouncedSearchTerm, sortBy, sortOrder]);

  const fetchContacts = useCallback(async () => {
    if (!user || !effectiveAgentId) {
      setContacts([]);
      setAllContacts([]);
      setTotalContacts(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.info('[useContacts] fetchContacts', {
      userId: user.id,
      viewingAgentId,
      effectiveAgentId,
      debouncedSearchTerm,
      currentPage,
      sortBy,
      sortOrder,
    });

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
          [
            `first_name.ilike.%${trimmed}%`,
            `last_name.ilike.%${trimmed}%`,
            `email.ilike.%${trimmed}%`,
            `phone.ilike.%${trimmed}%`,
          ].join(','),
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setContacts((data as Contact[]) || []);
      const total = count || 0;
      setTotalContacts(total);
      setTotalPages(Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));

      // Also fetch all contacts for dashboard/enrichment functions
      const all = await fetchAllContacts();
      setAllContacts(all);
    } catch (error) {
      console.error('[useContacts] Error fetching contacts:', error);
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
    viewingAgentId,
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

    // Note: DNC checks are now handled by monthly automation only

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

    console.log(`Processing ${csvData.length} contacts for upload`);

    // Use batch processing for large uploads
    const BATCH_SIZE = 100;
    const results: Contact[] = [];

    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);

      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
          csvData.length / BATCH_SIZE,
        )}`,
      );

      const contactsWithAgent = batch.map((contact) => ({
        ...contact,
        agent_id: effectiveAgentId,
        category: contact.last_name.charAt(0).toUpperCase() || 'A',
      }));

      const { data, error } = await supabase
        .from('contacts')
        .insert(contactsWithAgent)
        .select();

      if (error) {
        console.error(
          `Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          error,
        );
        throw error;
      }

      results.push(...((data as Contact[]) || []));
    }

    console.log(`Successfully uploaded ${results.length} contacts`);
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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  // Debounce search term to avoid excessive API calls
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
