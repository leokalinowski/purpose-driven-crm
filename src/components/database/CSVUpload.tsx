
import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  category: string;
  agent_id: string;
}

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload?: (csvData: any[]) => Promise<void> | void; // optional callback for parent-managed upload
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ open, onOpenChange, onUpload }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const agentId = user?.id || '';

  const parseCSV = (text: string): ContactInput[] => {
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
    const contacts: ContactInput[] = [];
    const skipped: number[] = []; // Track skipped row numbers

    data.forEach((row: any, index: number) => {
      const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, '_');
      const getValue = (keys: string[]) => {
        for (const k of keys) {
          const nk = normalizeKey(k);
          const val = row[nk] ?? row[k] ?? '';
          if (val) return String(val);
        }
        return '';
      };

      const email = getValue(['email', 'email_address', 'email address']);
      if (!email) {
        skipped.push(index + 1); // Skip if no email
        return;
      }

      const lastName = getValue(['last_name', 'lastname', 'last name']) || 'Unknown'; // Default if missing

      const tagsRaw = getValue(['tags']);
      const tagList =
        tagsRaw
          ? tagsRaw
              .split(/[;,]/) // support both semicolons and commas
              .map((t: string) => t.trim())
              .filter(Boolean)
          : null;

      const dncRaw = getValue(['dnc', 'do not contact', 'do_not_contact']).toString().toLowerCase();
      const dncVal = ['true', '1', 'yes', 'y'].includes(dncRaw);

      const contact: ContactInput = {
        first_name: getValue(['first_name', 'firstname', 'first name']),
        last_name: lastName,
        phone: getValue(['phone', 'phone_number', 'phone number']),
        email,
        address_1: getValue(['address_1', 'address1', 'address 1', 'address']),
        address_2: getValue(['address_2', 'address2', 'address 2']),
        zip_code: getValue(['zip_code', 'zipcode', 'zip code', 'zip']),
        state: getValue(['state']),
        city: getValue(['city']),
        tags: tagList,
        dnc: dncVal,
        notes: getValue(['notes']),
        category: lastName.charAt(0).toUpperCase() || 'U',
        agent_id: agentId,
      };

      contacts.push(contact);
    });

    if (skipped.length > 0) {
      toast({ title: 'Warning', description: `Skipped ${skipped.length} rows missing email (rows: ${skipped.join(', ')})` });
    }

    if (contacts.length === 0) throw new Error('No valid contacts found in CSV');
    return contacts;
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      if (!agentId) {
        toast({ title: 'Error', description: 'Please log in to upload contacts.' });
        onOpenChange(false);
        return;
      }

      const text = await file.text();
      const contacts = parseCSV(text);
      console.log('Parsed contacts from CSV:', contacts);

      // If parent provided onUpload, delegate to parent (it will handle inserting and refreshing)
      if (onUpload) {
        const payload = contacts.map(({ agent_id, category, ...rest }) => rest);
        await onUpload(payload);
        // Parent handles toast and closing dialog
        return;
      }

      // Fallback: handle upload internally
      const { data, count, error } = await supabase
        .from('contacts')
        .upsert(contacts, { onConflict: 'email, agent_id' })
        .select();

      if (error) throw error;

      const addedCount = count || data?.length || 0;
      console.log('Inserted/updated contacts:', data);

      if (addedCount === 0) {
        throw new Error('No contacts were added/updated. Check for duplicates or invalid data.');
      }

      toast({ title: 'Success', description: `${addedCount} contacts uploaded/updated!` });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Upload error details:', error);
      toast({ title: 'Error', description: error?.message || 'Upload failed. Check console for details.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    if (csvFile) {
      handleFileUpload(csvFile);
    } else {
      toast({ title: 'Error', description: 'Please upload a CSV file' });
    }
  };

  const downloadTemplate = () => {
    const template = [
      'first_name,last_name,phone,email,address_1,address_2,city,state,zip_code,tags,dnc,notes',
      'John,Doe,555-1234,john@example.com,123 Main St,Apt 4,Anytown,CA,12345,client;lead,false,Important client',
      'Jane,Smith,555-5678,jane@example.com,456 Elm St,,Othertown,TX,67890,prospect,true,Do not call'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Contacts CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop your CSV file here, or click to browse
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileUpload(file);
                };
                input.click();
              }}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Browse Files'}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">CSV Format Requirements:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Headers: first_name, last_name, phone, email, etc.</li>
              <li>• last_name is required for each contact</li>
              <li>• Tags should be separated by semicolons (;) or commas (,)</li>
              <li>• DNC column should be true/false or 1/0</li>
            </ul>
          </div>
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
