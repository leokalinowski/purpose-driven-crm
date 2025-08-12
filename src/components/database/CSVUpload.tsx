import React, { useState } from 'react';
import Papa from 'papaparse'; // Install with npm install papaparse
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useSupabaseClient } from '@supabase/auth-helpers-react'; // Assuming you use this for Supabase client

interface ContactInput {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address_1: string;
  address_2: string;
  zip_code: string;
  state: string;
  city: string;
  tags: string[] | null;
  dnc: boolean;
  notes: string;
  category: string; // Added for first letter of last name
  agent_id: string; // Added for current agent
}

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ open, onOpenChange }) => {
  const supabase = useSupabaseClient(); // Get Supabase client
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Get current agent's ID from Supabase auth
  const { data: { user } } = supabase.auth.getUser(); // Simple way to get user
  const agentId = user?.id || ''; // Agent ID is user ID

  if (!agentId) {
    toast({ title: 'Error', description: 'Please log in to upload contacts.' });
    onOpenChange(false);
    return null;
  }

  const parseCSV = (text: string): ContactInput[] => {
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
    const contacts: ContactInput[] = data.map((row: any) => {
      const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, '_');
      const getValue = (keys: string[]) => {
        for (const k of keys) {
          const val = row[normalizeKey(k)] || row[k] || '';
          if (val) return val;
        }
        return '';
      };

      const contact: ContactInput = {
        first_name: getValue(['first_name', 'firstname', 'first name']),
        last_name: getValue(['last_name', 'lastname', 'last name']),
        phone: getValue(['phone', 'phone_number', 'phone number']),
        email: getValue(['email', 'email_address', 'email address']),
        address_1: getValue(['address_1', 'address1', 'address 1', 'address']),
        address_2: getValue(['address_2', 'address2', 'address 2']),
        zip_code: getValue(['zip_code', 'zipcode', 'zip code', 'zip']),
        state: getValue(['state']),
        city: getValue(['city']),
        tags: getValue(['tags']) ? getValue(['tags']).split(';').map((t: string) => t.trim()) : null,
        dnc: [true, 'true', 1, '1', 'yes'].includes(getValue(['dnc', 'do not contact', 'do_not_contact']).toLowerCase()),
        notes: getValue(['notes']),
        category: getValue(['last_name']).charAt(0).toUpperCase() || 'U', // U for Unknown
        agent_id: agentId,
      };

      return contact;
    }).filter(contact => contact.last_name && contact.email); // Require last_name and email

    if (contacts.length === 0) throw new Error('No valid contacts found in CSV');
    return contacts;
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const contacts = parseCSV(text);

      // Upsert to Supabase (update if email + agent_id match)
      const { data, error } = await supabase
        .from('contacts')
        .upsert(contacts, { onConflict: 'email, agent_id' }); // Assume unique on email per agent

      if (error) throw error;

      toast({ title: 'Success', description: `${contacts.length} contacts uploaded/updated!` });
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast({ title: 'Error', description: error.message || 'Failed to upload CSV. Check file format.' });
    } finally {
      setLoading(false);
    }
  };

  // Drag/drop and other UI same as before...

  // (Paste the rest of the UI code from your original, like handleDrag, handleDrop, downloadTemplate)
  // For downloadTemplate, keep it similar, but add category example if wanted.
};