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

export const useContacts = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof Contact>('last_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const ITEMS_PER_PAGE = 25;

  const fetchContacts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('agent_id', user.id);

      // Apply search filter
      if (debouncedSearchTerm) {
        query = query.or(`first_name.ilike.%${debouncedSearchTerm}%,last_name.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%,phone.ilike.%${debouncedSearchTerm}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setContacts((data as Contact[]) || []);
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async (contactData: ContactInput) => {
    if (!user) throw new Error('User not authenticated');

    // Category will be set automatically by the database trigger
    const { data, error } = await supabase
      .from('contacts')
      .insert([{
        ...contactData,
        agent_id: user.id,
        category: contactData.last_name ? contactData.last_name.charAt(0).toUpperCase() : 'A',
      }])
      .select()
      .single();

    if (error) throw error;

    // Automatically check DNC if phone number exists
    if (data && contactData.phone?.trim()) {
      try {
        await supabase.functions.invoke('dnc-single-check', {
          body: { 
            phone: contactData.phone.trim(),
            contactId: data.id 
          }
        });
        console.log('DNC check initiated for new contact');
      } catch (error) {
        console.error('Failed to initiate DNC check:', error);
        // Don't fail the contact creation if DNC check fails
      }
    }

    fetchContacts();
    return data;
  };

  const updateContact = async (id: string, contactData: Partial<ContactInput>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .update(contactData)
      .eq('id', id)
      .eq('agent_id', user.id)
      .select()
      .single();

    if (error) throw error;

    fetchContacts();
    return data;
  };

  const deleteContact = async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('agent_id', user.id);

    if (error) throw error;

    fetchContacts();
  };

  const uploadCSV = async (csvData: ContactInput[]) => {
    if (!user) throw new Error('User not authenticated');

    const contactsWithAgent = csvData.map(contact => ({
      ...contact,
      agent_id: user.id,
      category: contact.last_name ? contact.last_name.charAt(0).toUpperCase() : 'A',
    }));

    const { data, error } = await supabase
      .from('contacts')
      .insert(contactsWithAgent)
      .select();

    if (error) throw error;

    // Automatically check DNC for all contacts with phone numbers
    if (data && data.length > 0) {
      const contactsWithPhones = data.filter(contact => contact.phone?.trim());
      
      if (contactsWithPhones.length > 0) {
        console.log(`Initiating DNC checks for ${contactsWithPhones.length} contacts with phone numbers`);
        
        // Process DNC checks in small batches to avoid overwhelming the API
        for (const contact of contactsWithPhones) {
          try {
            await supabase.functions.invoke('dnc-single-check', {
              body: { 
                phone: contact.phone.trim(),
                contactId: contact.id 
              }
            });
            // Small delay between requests to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error(`Failed to initiate DNC check for contact ${contact.id}:`, error);
            // Continue with other contacts even if one fails
          }
        }
      }
    }

    fetchContacts();
    return data;
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
  }, [user, currentPage, debouncedSearchTerm, sortBy, sortOrder]);

  return {
    contacts,
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
  };
};