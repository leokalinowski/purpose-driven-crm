
import React, { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (rows: any[]) => Promise<void> | void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ open, onOpenChange, onUpload }) => {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parseCSV = useCallback(async (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          const data = Array.isArray(results.data) ? results.data : [];
          resolve(data);
        },
        error: (err) => reject(err),
      });
    });
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const rows = await parseCSV(file);
        if (!rows.length) {
          toast({ title: 'No rows found', description: 'The CSV appears to be empty.' });
          return;
        }
        await onUpload(rows);
        toast({ title: 'Upload ready', description: `${rows.length} rows parsed successfully.` });
        onOpenChange(false);
      } catch (error: any) {
        console.error('Error handling CSV:', error);
        toast({
          title: 'Error parsing CSV',
          description: error?.message || 'Please check your file format.',
        });
      } finally {
        setLoading(false);
        setDragActive(false);
      }
    },
    [onUpload, onOpenChange, parseCSV]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const headers = [
      'first_name',
      'last_name',
      'phone',
      'email',
      'address_1',
      'address_2',
      'zip_code',
      'state',
      'city',
      'tags',
      'dnc',
      'notes',
    ];
    const sample = [
      {
        first_name: 'John',
        last_name: 'Doe',
        phone: '555-123-4567',
        email: 'john.doe@example.com',
        address_1: '123 Main St',
        address_2: 'Apt 4B',
        zip_code: '90210',
        state: 'CA',
        city: 'Beverly Hills',
        tags: 'buyer;vip',
        dnc: 'false',
        notes: 'Met at open house',
      },
    ];
    const csv = Papa.unparse({ fields: headers, data: sample.map((r) => headers.map((h) => (r as any)[h] ?? '')) });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Contacts CSV</DialogTitle>
        </DialogHeader>

        <div
          className={`mt-4 border-2 border-dashed rounded-md p-6 text-center transition-colors ${
            dragActive ? 'border-primary bg-muted/50' : 'border-border'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop your CSV file here, or click to select.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Choose File
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
