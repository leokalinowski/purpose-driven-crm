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

    const { data, error } = await supabase
      .from('contacts')
      .insert([{
        ...contactData,
        agent_id: user.id,
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
      .eq('agent_id', user.id)
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
      .eq('agent_id', user.id);

    if (error) throw error;
  };

  const uploadCSV = async (csvData: ContactInput[]) => {
    if (!user) throw new Error('User not authenticated');

    // Check for duplicates before inserting
    console.log(`Checking for duplicates among ${csvData.length} contacts`);
    
    // Get all emails and phones from the CSV contacts
    const csvEmails = csvData.filter(c => c.email?.trim()).map(c => c.email.trim());
    const csvPhones = csvData.filter(c => c.phone?.trim()).map(c => c.phone.trim());
    
    console.log(`CSV contains ${csvEmails.length} emails and ${csvPhones.length} phones`);
    
    if (csvEmails.length > 0 || csvPhones.length > 0) {
      // Build OR conditions for all emails and phones
      const orConditions = [];
      
      // Add email conditions
      csvEmails.forEach(email => {
        orConditions.push(`email.eq.${email}`);
      });
      
      // Add phone conditions  
      csvPhones.forEach(phone => {
        orConditions.push(`phone.eq.${phone}`);
      });
      
      if (orConditions.length > 0) {
        console.log(`Checking ${orConditions.length} potential duplicates in database`);
        
        const { data: existingContacts, error: duplicateError } = await supabase
          .from('contacts')
          .select('id, email, phone, first_name, last_name')
          .eq('agent_id', user.id)
          .or(orConditions.join(','));
          
        if (duplicateError) {
          console.error('Error checking for duplicates:', duplicateError);
          throw new Error(`Failed to check for duplicates: ${duplicateError.message}`);
        }
        
        if (existingContacts && existingContacts.length > 0) {
          const duplicateInfo = existingContacts.map(d => {
            const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Unknown';
            return `${name} (Email: ${d.email || 'N/A'}, Phone: ${d.phone || 'N/A'})`;
          }).join('; ');
          
          console.error('Duplicates found:', duplicateInfo);
          throw new Error(`Duplicate contacts found: ${duplicateInfo}. Please remove these duplicates from your CSV and try again.`);
        }
      }
    }

    console.log('No duplicates found, proceeding with import');

    const contactsWithAgent = csvData.map(contact => ({
      ...contact,
      agent_id: user.id,
      category: contact.last_name.charAt(0).toUpperCase() || 'A',
    }));

    const { data, error } = await supabase
      .from('contacts')
      .insert(contactsWithAgent)
      .select();

    if (error) throw error;

    // Note: DNC checks are now handled by monthly automation only

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