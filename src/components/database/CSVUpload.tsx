
import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
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
  onUpload: (csvData: any[]) => Promise<void>;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ open, onOpenChange, onUpload }) => {
  const { user } = useAuth();
  const agentId = user?.id || '';
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const parseCSV = (text: string): ContactInput[] => {
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
    const contacts: ContactInput[] = (data as any[]).map((row: any) => {
      const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, '_');
      const getValue = (keys: string[]) => {
        for (const k of keys) {
          const val = row[normalizeKey(k)] ?? row[k] ?? '';
          if (val) return val;
        }
        return '';
      };

      const contact: ContactInput = {
        first_name: String(getValue(['first_name', 'firstname', 'first name'])).trim(),
        last_name: String(getValue(['last_name', 'lastname', 'last name'])).trim(),
        phone: String(getValue(['phone', 'phone_number', 'phone number'])).trim(),
        email: String(getValue(['email', 'email_address', 'email address'])).trim(),
        address_1: String(getValue(['address_1', 'address1', 'address 1', 'address'])).trim(),
        address_2: String(getValue(['address_2', 'address2', 'address 2'])).trim(),
        zip_code: String(getValue(['zip_code', 'zipcode', 'zip code', 'zip'])).trim(),
        state: String(getValue(['state'])).trim(),
        city: String(getValue(['city'])).trim(),
        tags: getValue(['tags'])
          ? String(getValue(['tags']))
              .split(';')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : null,
        dnc: ['true', '1', 'yes'].includes(String(getValue(['dnc', 'do not contact', 'do_not_contact'])).toLowerCase()),
        notes: String(getValue(['notes'])).trim(),
        category: String(getValue(['last_name'])).charAt(0).toUpperCase() || 'U',
        agent_id: agentId,
      };

      return contact;
    }).filter(contact => contact.last_name && contact.email);

    if (contacts.length === 0) throw new Error('No valid contacts found in CSV');
    return contacts;
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const contacts = parseCSV(text);
      console.log('Parsed contacts from CSV:', contacts);

      if (!onUpload) {
        throw new Error('Upload handler is not available.');
      }

      await onUpload(contacts);
      // Success handling (toast/close) is managed by the parent (Database.tsx) to avoid duplicates.
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
