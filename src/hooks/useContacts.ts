import { useState, useEffect } from 'react';
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
  notes: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export type ContactInput = Omit<Contact, 'id' | 'agent_id' | 'category' | 'created_at' | 'updated_at'>;

export const useContacts = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
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
      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setContacts(data || []);
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

  useEffect(() => {
    fetchContacts();
  }, [user, currentPage, searchTerm, sortBy, sortOrder]);

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