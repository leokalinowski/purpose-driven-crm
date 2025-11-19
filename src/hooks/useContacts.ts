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

export type ContactInput = Omit<Contact, 'id' | 'agent_id' | 'category' | 'created_at' | 'updated_at' | 'dnc_last_checked' | 'last_activity_date' | 'activity_count'>;

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
  
  // Check if viewing own contacts (to decide whether to use edge function)
  const isViewingOwn = !viewingAgentId || viewingAgentId === user?.id;

  const fetchAllContacts = async (): Promise<Contact[]> => {
    if (!user || !effectiveAgentId) return [];

    try {
      if (debouncedSearchTerm) {
        let edgeFunctionSucceeded = false;
        
        // Only use edge function when viewing own contacts
        if (isViewingOwn) {
          try {
            // Try the advanced search edge function for all contacts too
            const { data, error } = await supabase.functions.invoke('contact-search', {
              body: {
                searchTerm: debouncedSearchTerm,
                agentId: effectiveAgentId,
                page: 1,
                limit: 1000, // Get all for dashboard
                sortBy,
                sortOrder
              }
            });

            if (error) throw error;

            return (data?.data as Contact[]) || [];
          } catch (edgeFunctionError) {
            console.warn('Edge function search failed for all contacts, falling back to client-side search:', edgeFunctionError);
          }
        }
        
        // Client-side search (used when viewing other agents or edge function failed)
        // Fallback to client-side search with improved logic
        const trimmedTerm = debouncedSearchTerm.trim();
        const searchTerms = trimmedTerm.split(/\s+/).filter(term => term.length > 0);

        if (searchTerms.length === 2) {
            // Special handling for two terms: use intersection of queries to achieve AND logic
            const [first, last] = searchTerms;

            // Query 1: contacts with first term in first_name
            const firstNameQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('first_name', `%${first}%`);

            // Query 2: contacts with second term in last_name
            const lastNameQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('last_name', `%${last}%`);

            // Also check reverse order
            const reverseFirstQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('first_name', `%${last}%`);

            const reverseLastQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('last_name', `%${first}%`);

            const [firstResults, lastResults, reverseFirstResults, reverseLastResults] = await Promise.all([
              firstNameQuery,
              lastNameQuery,
              reverseFirstQuery,
              reverseLastQuery
            ]);

            if (firstResults.error || lastResults.error || reverseFirstResults.error || reverseLastResults.error) {
              throw firstResults.error || lastResults.error || reverseFirstResults.error || reverseLastResults.error;
            }

            // Find intersection: contacts that appear in both queries
            const firstNameIds = new Set(firstResults.data?.map(c => c.id) || []);
            const lastNameIds = new Set(lastResults.data?.map(c => c.id) || []);
            const intersectionIds = new Set([...firstNameIds].filter(id => lastNameIds.has(id)));

            const reverseFirstIds = new Set(reverseFirstResults.data?.map(c => c.id) || []);
            const reverseLastIds = new Set(reverseLastResults.data?.map(c => c.id) || []);
            const reverseIntersectionIds = new Set([...reverseFirstIds].filter(id => reverseLastIds.has(id)));

            // Combine both orderings
            const allMatchingIds = new Set([...intersectionIds, ...reverseIntersectionIds]);

            if (allMatchingIds.size > 0) {
              // Get full contact data for matching IDs
              const { data: matchedContacts, error: matchError } = await supabase
                .from('contacts')
                .select('*')
                .eq('agent_id', effectiveAgentId)
                .in('id', Array.from(allMatchingIds))
                .order(sortBy, { ascending: sortOrder === 'asc' });

              if (matchError) throw matchError;

              return (matchedContacts as Contact[]) || [];
            } else {
              return [];
            }
          } else {
            // Single term or multiple terms: use regular OR search
            let orConditions = [
              `first_name.ilike.%${trimmedTerm}%`,
              `last_name.ilike.%${trimmedTerm}%`,
              `email.ilike.%${trimmedTerm}%`,
              `phone.ilike.%${trimmedTerm}%`
            ];

            if (searchTerms.length === 1) {
              const term = searchTerms[0];
              orConditions.push(`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`);
            } else {
              searchTerms.forEach(term => {
                orConditions.push(`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`);
              });
            }

            const query = supabase
              .from('contacts')
              .select('*')
              .eq('agent_id', effectiveAgentId)
              .or(orConditions.join(','))
              .order(sortBy, { ascending: sortOrder === 'asc' });

            const { data, error } = await query;

            if (error) throw error;

            return (data as Contact[]) || [];
          }
        } else {
        // Regular fetch without search
        const query = supabase
          .from('contacts')
          .select('*')
          .eq('agent_id', effectiveAgentId)
          .order(sortBy, { ascending: sortOrder === 'asc' });

        const { data, error } = await query;

        if (error) throw error;

        return (data as Contact[]) || [];
      }
    } catch (error) {
      console.error('Error fetching all contacts:', error);
      return [];
    }
  };

  const fetchContacts = useCallback(async () => {
    if (!user || !effectiveAgentId) return;

    console.log('[useContacts] fetchContacts', {
      userId: user?.id,
      viewingAgentId,
      effectiveAgentId,
      debouncedSearchTerm,
      currentPage,
      isViewingOwn
    });

    setLoading(true);
    try {
      if (debouncedSearchTerm) {
        let edgeFunctionSucceeded = false;
        
        // Only use edge function when viewing own contacts
        if (isViewingOwn) {
          try {
            // Try the advanced search edge function
            const { data, error } = await supabase.functions.invoke('contact-search', {
              body: {
                searchTerm: debouncedSearchTerm,
                agentId: effectiveAgentId,
                page: currentPage,
                limit: ITEMS_PER_PAGE,
                sortBy,
                sortOrder
              }
            });

            if (error) throw error;

            console.log('[useContacts] edge function returned contacts:', data?.data?.length);
            setContacts((data?.data as Contact[]) || []);
            setTotalContacts(data?.count || 0);
            setTotalPages(data?.totalPages || 1);
            edgeFunctionSucceeded = true;
          } catch (edgeFunctionError) {
            console.warn('Edge function search failed, falling back to client-side search:', edgeFunctionError);
          }
        }
        
        // Client-side search (used when viewing other agents or edge function fails)
        if (!isViewingOwn || !edgeFunctionSucceeded) {

          // Fallback to client-side search with improved logic
          const trimmedTerm = debouncedSearchTerm.trim();
          const searchTerms = trimmedTerm.split(/\s+/).filter(term => term.length > 0);

          if (searchTerms.length === 2) {
            // Special handling for two terms: use intersection of queries to achieve AND logic
            const [first, last] = searchTerms;

            // Query 1: contacts with first term in first_name
            const firstNameQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('first_name', `%${first}%`);

            // Query 2: contacts with second term in last_name
            const lastNameQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('last_name', `%${last}%`);

            // Also check reverse order
            const reverseFirstQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('first_name', `%${last}%`);

            const reverseLastQuery = supabase
              .from('contacts')
              .select('id, first_name, last_name, email, phone')
              .eq('agent_id', effectiveAgentId)
              .ilike('last_name', `%${first}%`);

            const [firstResults, lastResults, reverseFirstResults, reverseLastResults] = await Promise.all([
              firstNameQuery,
              lastNameQuery,
              reverseFirstQuery,
              reverseLastQuery
            ]);

            if (firstResults.error || lastResults.error || reverseFirstResults.error || reverseLastResults.error) {
              throw firstResults.error || lastResults.error || reverseFirstResults.error || reverseLastResults.error;
            }

            // Find intersection: contacts that appear in both queries
            const firstNameIds = new Set(firstResults.data?.map(c => c.id) || []);
            const lastNameIds = new Set(lastResults.data?.map(c => c.id) || []);
            const intersectionIds = new Set([...firstNameIds].filter(id => lastNameIds.has(id)));

            const reverseFirstIds = new Set(reverseFirstResults.data?.map(c => c.id) || []);
            const reverseLastIds = new Set(reverseLastResults.data?.map(c => c.id) || []);
            const reverseIntersectionIds = new Set([...reverseFirstIds].filter(id => reverseLastIds.has(id)));

            // Combine both orderings
            const allMatchingIds = new Set([...intersectionIds, ...reverseIntersectionIds]);

            if (allMatchingIds.size > 0) {
              // Get full contact data for matching IDs
              const { data: matchedContacts, error: matchError } = await supabase
                .from('contacts')
                .select('*', { count: 'exact' })
                .eq('agent_id', effectiveAgentId)
                .in('id', Array.from(allMatchingIds))
                .order(sortBy, { ascending: sortOrder === 'asc' })
                .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

              if (matchError) throw matchError;

              setContacts((matchedContacts as Contact[]) || []);
              setTotalContacts(allMatchingIds.size);
              setTotalPages(Math.ceil(allMatchingIds.size / ITEMS_PER_PAGE));
            } else {
              // No matches found
              setContacts([]);
              setTotalContacts(0);
              setTotalPages(0);
            }
          } else {
            // Single term or multiple terms: use regular OR search
            let orConditions = [
              `first_name.ilike.%${trimmedTerm}%`,
              `last_name.ilike.%${trimmedTerm}%`,
              `email.ilike.%${trimmedTerm}%`,
              `phone.ilike.%${trimmedTerm}%`
            ];

            if (searchTerms.length === 1) {
              const term = searchTerms[0];
              orConditions.push(`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`);
            } else {
              searchTerms.forEach(term => {
                orConditions.push(`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`);
              });
            }

            const query = supabase
              .from('contacts')
              .select('*', { count: 'exact' })
              .eq('agent_id', effectiveAgentId)
              .or(orConditions.join(','))
              .order(sortBy, { ascending: sortOrder === 'asc' })
              .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            setContacts((data as Contact[]) || []);
            setTotalContacts(count || 0);
            setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
          }
        }
      } else {
        // Regular fetch without search
        const query = supabase
          .from('contacts')
          .select('*', { count: 'exact' })
          .eq('agent_id', effectiveAgentId)
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        setContacts((data as Contact[]) || []);
        setTotalContacts(count || 0);
        setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
      }

      // Also fetch all contacts for dashboard/enrichment functions
      const allContactsData = await fetchAllContacts();
      setAllContacts(allContactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, effectiveAgentId, debouncedSearchTerm, currentPage, sortBy, sortOrder]);

  const addContact = async (contactData: ContactInput) => {
    if (!user || !effectiveAgentId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .insert([{
        ...contactData,
        agent_id: effectiveAgentId,
        category: contactData.last_name.charAt(0).toUpperCase() || 'A',
      }])
      .select()
      .single();

    if (error) throw error;

    // Note: DNC checks are now handled by monthly automation only

    fetchContacts();
    return data;
  };

  const updateContact = async (id: string, contactData: Partial<ContactInput>) => {
    if (!user) throw new Error('User not authenticated');

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
    if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('agent_id', effectiveAgentId);

    if (error) throw error;
  };

  const uploadCSV = async (csvData: ContactInput[]) => {
    if (!user) throw new Error('User not authenticated');

    console.log(`Processing ${csvData.length} contacts for upload`);

    // Use batch processing for large uploads
    const BATCH_SIZE = 100;
    const results = [];

    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(csvData.length / BATCH_SIZE)}`);
      
      const contactsWithAgent = batch.map(contact => ({
        ...contact,
        agent_id: effectiveAgentId,
        category: contact.last_name.charAt(0).toUpperCase() || 'A',
      }));

      const { data, error } = await supabase
        .from('contacts')
        .insert(contactsWithAgent)
        .select();

      if (error) {
        console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        throw error;
      }

      results.push(...(data || []));
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