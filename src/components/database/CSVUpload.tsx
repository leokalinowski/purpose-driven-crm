import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { ContactInput } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (data: ContactInput[]) => Promise<void>;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({
  open,
  onOpenChange,
  onUpload,
}) => {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const parseCSV = (text: string): ContactInput[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const contacts: ContactInput[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const contact: any = {
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        address_1: '',
        address_2: '',
        zip_code: '',
        state: '',
        city: '',
        tags: null,
        dnc: false,
        notes: '',
      };

      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        switch (header) {
          case 'first_name':
          case 'firstname':
          case 'first name':
            contact.first_name = value;
            break;
          case 'last_name':
          case 'lastname':
          case 'last name':
            contact.last_name = value;
            break;
          case 'phone':
          case 'phone_number':
          case 'phone number':
            contact.phone = value;
            break;
          case 'email':
          case 'email_address':
          case 'email address':
            contact.email = value;
            break;
          case 'address_1':
          case 'address1':
          case 'address 1':
          case 'address':
            contact.address_1 = value;
            break;
          case 'address_2':
          case 'address2':
          case 'address 2':
            contact.address_2 = value;
            break;
          case 'zip_code':
          case 'zipcode':
          case 'zip code':
          case 'zip':
            contact.zip_code = value;
            break;
          case 'state':
            contact.state = value;
            break;
          case 'city':
            contact.city = value;
            break;
          case 'tags':
            contact.tags = value ? value.split(';').map(t => t.trim()) : null;
            break;
          case 'dnc':
          case 'do not contact':
            contact.dnc = value.toLowerCase() === 'true' || value === '1';
            break;
          case 'notes':
            contact.notes = value;
            break;
        }
      });

      if (contact.last_name) {
        contacts.push(contact);
      }
    }

    return contacts;
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const contacts = parseCSV(text);
      console.log('Parsed contacts from CSV:', contacts);

      const { data, count, error } = await supabase
        .from('contacts')
        .upsert(contacts, { onConflict: 'email, agent_id' })
        .select();

      if (error) throw error;

      const addedCount = count ?? data?.length ?? 0;
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
      alert('Please upload a CSV file');
    }
  };

  const downloadTemplate = () => {
    const template = [
      'first_name,last_name,phone,email,address_1,address_2,city,state,zip_code,tags,dnc,notes',
      'John,Doe,555-1234,john@example.com,123 Main St,,Anytown,CA,12345,client;lead,false,Sample contact'
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
              <li>• Tags should be separated by semicolons (;)</li>
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
