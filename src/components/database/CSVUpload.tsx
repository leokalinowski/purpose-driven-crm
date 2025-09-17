
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Upload, Download, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ContactInput } from '@/hooks/useContacts';
import { useAgents } from '@/hooks/useAgents';
import { useUserRole } from '@/hooks/useUserRole';
import { ErrorBoundary } from '@/components/ui/error-boundary';

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload?: (csvData: ContactInput[], agentId?: string) => Promise<void> | void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ open, onOpenChange, onUpload }) => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { agents, loading: agentsLoading, getAgentDisplayName, error: agentsError, fetchAgents } = useAgents();
  
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<'upload' | 'map'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string>('__self__');

  const REQUIRED_FIELDS: Array<keyof ContactInput> = ['last_name'];
  const OPTIONAL_FIELDS: Array<keyof ContactInput> = ['first_name','email','phone','address_1','address_2','city','state','zip_code','tags','dnc','notes'];
  const ALL_FIELDS: Array<keyof ContactInput> = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

  const agentId = useMemo(() => user?.id || '', [user?.id]);

  // Reset form when dialog closes and fetch agents when opening for admin users
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setCsvHeaders([]);
      setRawRows([]);
      setMapping({});
      setSelectedAgentId('__self__');
      setLoading(false);
      setDragActive(false);
    } else if (open && isAdmin && !roleLoading) {
      // Only fetch agents when dialog opens and user is admin
      fetchAgents();
    }
  }, [open, isAdmin, roleLoading, fetchAgents]);
  
  const parseCSV = useCallback((text: string): ContactInput[] => {
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
        };

      contacts.push(contact);
    });

    if (skipped.length > 0) {
      toast({ title: 'Warning', description: `Skipped ${skipped.length} rows missing email (rows: ${skipped.join(', ')})` });
    }

    if (contacts.length === 0) throw new Error('No valid contacts found in CSV');
    return contacts;
  }, []);

const handleFileUpload = useCallback(async (file: File) => {
  if (loading) return; // Prevent multiple uploads
  
  setLoading(true);
  try {
    if (!agentId) {
      toast({ title: 'Error', description: 'Please log in to upload contacts.' });
      onOpenChange(false);
      return;
    }

    // Read file text and strip potential BOM
    const rawText = await file.text();
    const text = rawText.replace(/^\uFEFF/, '');
    
    // Try different delimiters (tolerate non-critical errors) and pick the one with most fields
    const delimiters = [',', ';', '\t', '|'];
    let bestResult: Papa.ParseResult<any> | null = null;
    let maxFields = 0;

    for (const delimiter of delimiters) {
      try {
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          delimiter: delimiter === '\t' ? '\t' : delimiter,
        });
        const fieldCount = result.meta.fields?.length || 0;
        const hasCritical = result.errors.some((e) => e.type === 'Delimiter' || e.type === 'Quotes');
        console.debug('[CSVUpload] Delimiter attempt', delimiter === '\t' ? 'TAB' : delimiter, {
          fieldCount,
          errors: result.errors.map((e) => e.type),
        });
        if (!hasCritical && fieldCount >= maxFields) {
          bestResult = result;
          maxFields = fieldCount;
        }
      } catch (e) {
        console.debug('[CSVUpload] Delimiter attempt failed', delimiter, e);
        continue; // Try next delimiter
      }
    }

    // If no good result found, try Papa's auto-detection
    if (!bestResult || maxFields <= 1) {
      console.debug('[CSVUpload] Falling back to auto-detect');
      bestResult = Papa.parse(text, { header: true, skipEmptyLines: true });
    }

    if (!bestResult) {
      throw new Error('Failed to parse CSV file');
    }

    // Validate parsing results (only fail on critical errors)
    if (bestResult.errors.length > 0) {
      const criticalErrors = bestResult.errors.filter(
        (e) => e.type === 'Delimiter' || e.type === 'Quotes'
      );
      if (criticalErrors.length > 0) {
        throw new Error(
          `CSV parsing error: ${criticalErrors[0].message}. Please check your CSV file format.`
        );
      }
    }

    let rows = (bestResult.data as any[]).filter((r) => r && Object.keys(r).length > 0);
    let headersRaw = (bestResult.meta.fields || Object.keys(rows[0] || {})) as string[];
    let headers = headersRaw.map((h) => String(h).trim());

    // Heuristic: if only 1 header detected but the first line contains common delimiters, re-parse with the most likely delimiter
    if ((!headers || headers.length <= 1) && text) {
      const firstLine = text.split(/\r?\n/)[0] || '';
      const counts = delimiters.map((d) => ({ d, c: (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length }));
      const best = counts.sort((a, b) => b.c - a.c)[0];
      if (best && best.c > 0) {
        console.debug('[CSVUpload] Re-parsing using heuristic delimiter', best.d);
        const reparsed = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: best.d });
        const criticalErrors = reparsed.errors.filter((e) => e.type === 'Delimiter' || e.type === 'Quotes');
        if (criticalErrors.length === 0) {
          rows = (reparsed.data as any[]).filter((r) => r && Object.keys(r).length > 0);
          headersRaw = (reparsed.meta.fields || Object.keys(rows[0] || {})) as string[];
          headers = headersRaw.map((h) => String(h).trim());
        }
      }
    }

    // Validate CSV structure
    if (!headers || headers.length === 0) {
      throw new Error('No headers found in CSV file. Please ensure your CSV has a header row.');
    }
    if (rows.length === 0) {
      throw new Error('No data rows found in CSV file. Please ensure your CSV contains data below the headers.');
    }

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');

    const defaultMap: Record<string, string> = {};
    ALL_FIELDS.forEach((field) => {
      const match = headers.find((h: string) => {
        const nh = normalize(h);
        if (field === 'phone') return nh === 'phone' || nh === 'phone_number';
        if (field === 'zip_code') return nh === 'zip' || nh === 'zip_code' || nh === 'zipcode';
        if (field === 'last_name') return nh === 'last_name' || nh === 'lastname' || nh === 'last';
        if (field === 'first_name') return nh === 'first_name' || nh === 'firstname' || nh === 'first';
        return nh === field;
      });
      if (match) defaultMap[field] = match;
    });

    // Auto-import if headers match our template exactly
    const TEMPLATE_HEADERS = [
      'first_name','last_name','phone','email','address_1','address_2','city','state','zip_code','tags','dnc','notes'
    ];
    const headersNormalized = headers.map((h) => normalize(h));
    const isTemplate = JSON.stringify(headersNormalized) === JSON.stringify(TEMPLATE_HEADERS);

    if (isTemplate) {
      console.debug('[CSVUpload] Template detected. Auto-importing.');
      setCsvHeaders(headers as string[]);
      setRawRows(rows);
      setMapping(defaultMap);

      // Build contacts directly (same logic as handleImport)
      const normalizeVal = (v: any) => (v == null ? '' : String(v));
      const getVal = (row: any, field: keyof ContactInput) => {
        const header = (defaultMap as Record<string, string>)[field as string];
        if (!header || header === '__ignore__') return '';
        return normalizeVal(row[header]);
      };
      const contacts: ContactInput[] = rows
        .map((row: any) => {
          const last_name = getVal(row, 'last_name');
          if (!last_name) return null;
          const tagsRaw = getVal(row, 'tags');
          const tags = tagsRaw ? tagsRaw.split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : null;
          const dncRaw = getVal(row, 'dnc').toLowerCase();
          const dnc = ['true', '1', 'yes', 'y'].includes(dncRaw);
          const contact: ContactInput = {
            first_name: getVal(row, 'first_name'),
            last_name,
            phone: getVal(row, 'phone'),
            email: getVal(row, 'email'),
            address_1: getVal(row, 'address_1'),
            address_2: getVal(row, 'address_2'),
            city: getVal(row, 'city'),
            state: getVal(row, 'state'),
            zip_code: getVal(row, 'zip_code'),
            tags,
            dnc,
            notes: getVal(row, 'notes'),
          };
          return contact;
        })
        .filter(Boolean) as ContactInput[];

      if (contacts.length === 0) {
        toast({ title: 'Error', description: 'No valid rows. Ensure last_name is present.' });
      } else {
        // Determine which agent to assign contacts to
        const targetAgentId = isAdmin
          ? (selectedAgentId === '__self__' || !selectedAgentId ? agentId : selectedAgentId)
          : agentId;
        try {
          if (onUpload) {
            await onUpload(contacts, targetAgentId);
          } else {
            const contactsForDb = contacts.map((contact) => ({
              ...contact,
              agent_id: targetAgentId,
              category: contact.last_name.charAt(0).toUpperCase() || 'U',
            }));
            const { error } = await supabase.from('contacts').insert(contactsForDb).select();
            if (error) throw error;
          }
          toast({ title: 'Success', description: `${contacts.length} contacts imported!` });
          onOpenChange(false);
        } catch (e: any) {
          console.error('Auto-import failed:', e);
          toast({ title: 'Error', description: e?.message || 'Auto-import failed.' });
        }
      }
      return;
    }

    // Default: proceed to mapping step
    setCsvHeaders(headers as string[]);
    setRawRows(rows);
    setMapping(defaultMap);
    setStep('map');
  } catch (error: any) {
    console.error('CSV parsing error:', error);
    toast({ title: 'Error', description: error?.message || 'Failed to read CSV file.' });
  } finally {
    setLoading(false);
  }
}, [loading, agentId, onOpenChange, ALL_FIELDS, isAdmin, selectedAgentId, onUpload]);

  const handleImport = useCallback(async () => {
    try {
      const normalize = (v: any) => (v == null ? '' : String(v));
      const getVal = (row: any, field: keyof ContactInput) => {
        const header = mapping[field];
        if (!header || header === '__ignore__') return '';
        return normalize(row[header]);
      };

      const contacts: ContactInput[] = rawRows.map((row: any) => {
        const last_name = getVal(row, 'last_name');
        if (!last_name) return null;
        const tagsRaw = getVal(row, 'tags');
        const tags = tagsRaw
          ? tagsRaw.split(/[;,]/).map((t: string) => t.trim()).filter(Boolean)
          : null;
        const dncRaw = getVal(row, 'dnc').toLowerCase();
        const dnc = ['true', '1', 'yes', 'y'].includes(dncRaw);
        const contact: ContactInput = {
          first_name: getVal(row, 'first_name'),
          last_name,
          phone: getVal(row, 'phone'),
          email: getVal(row, 'email'),
          address_1: getVal(row, 'address_1'),
          address_2: getVal(row, 'address_2'),
          city: getVal(row, 'city'),
          state: getVal(row, 'state'),
          zip_code: getVal(row, 'zip_code'),
          tags,
          dnc,
          notes: getVal(row, 'notes'),
        };
        return contact;
      }).filter(Boolean) as ContactInput[];

      if (contacts.length === 0) {
        toast({ title: 'Error', description: 'No valid rows. Ensure last_name is mapped.' });
        return;
      }

      // Determine which agent to assign contacts to
      const targetAgentId = isAdmin
        ? (selectedAgentId === '__self__' || !selectedAgentId ? agentId : selectedAgentId)
        : agentId;
      if (onUpload) {
        await onUpload(contacts, targetAgentId);
        onOpenChange(false);
        return;
      }

      const contactsForDb = contacts.map(contact => ({
        ...contact,
        agent_id: targetAgentId,
        category: contact.last_name.charAt(0).toUpperCase() || 'U'
      }));
      const { data, error } = await supabase.from('contacts').insert(contactsForDb).select();
      if (error) throw error;
      toast({ title: 'Success', description: `${contacts.length} contacts imported!` });
      onOpenChange(false);
    } catch (e: any) {
      console.error('Import failed:', e);
      toast({ title: 'Error', description: e?.message || 'Failed to import contacts.' });
    }
  }, [rawRows, mapping, isAdmin, selectedAgentId, agentId, onUpload, onOpenChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
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
  }, [handleFileUpload]);

  const downloadTemplate = useCallback(() => {
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
  }, []);

  // Show agents error if there's one
  useEffect(() => {
    if (agentsError && isAdmin) {
      toast({ title: 'Warning', description: `Failed to load agents: ${agentsError}` });
    }
  }, [agentsError, isAdmin]);

  return (
    <ErrorBoundary>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Contacts CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple contacts at once. You can map columns to contact fields and assign them to specific agents.
            </DialogDescription>
          </DialogHeader>
<div className="space-y-4">
  {step === 'upload' ? (
    <>
      {/* Agent Selection for Admins */}
      {isAdmin && !roleLoading && (
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Agent Assignment</h4>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Assign all contacts to agent:
            </label>
            <Select 
              value={selectedAgentId} 
              onValueChange={setSelectedAgentId}
              disabled={agentsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an agent or keep default (yourself)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__self__">Assign to yourself</SelectItem>
                {agentsLoading && <SelectItem value="__loading__" disabled>Loading agents...</SelectItem>}
                {!agentsLoading && agents.length > 0 && agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {getAgentDisplayName(agent)}
                  </SelectItem>
                ))}
                {!agentsLoading && agents.length === 0 && (
                  <SelectItem value="__none__" disabled>No agents found</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default assigns to yourself. Choose an agent to override.
            </p>
          </div>
        </div>
      )}
      

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
            if (loading) return;
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
          {loading ? 'Processing...' : 'Browse Files'}
        </Button>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">CSV Format Requirements:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Headers: first_name, last_name, phone, email, etc.</li>
          <li>• last_name is required as the main data point</li>
          <li>• Tags can be separated by semicolons (;) or commas (,)</li>
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
    </>
  ) : (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium">Map your columns</h4>
        <p className="text-sm text-muted-foreground">Match your CSV columns to contact fields. Last name is required.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_FIELDS.map((field) => (
          <div key={field as string} className="space-y-1">
            <label className="text-sm font-medium">
              {String(field)}
              {REQUIRED_FIELDS.includes(field) && <span className="text-destructive ml-1">*</span>}
            </label>
            <Select
              value={mapping[field] || ''}
              onValueChange={(val) => setMapping((m) => ({ ...m, [field]: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {csvHeaders.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
                {!REQUIRED_FIELDS.includes(field) && (
                  <SelectItem value="__ignore__">Ignore</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {rawRows.length > 0 && (
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium mb-2">Preview (first 5 rows)</div>
          <div className="text-xs overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {ALL_FIELDS.filter((f) => mapping[f] && mapping[f] !== '__ignore__').map((f) => (
                    <th key={String(f)} className="text-left pr-3 py-1 capitalize">{String(f).replace('_',' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {ALL_FIELDS.filter((f) => mapping[f] && mapping[f] !== '__ignore__').map((f) => (
                      <td key={String(f)} className="pr-3 py-1">{String(row[mapping[f] as string] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
        <Button 
          onClick={handleImport} 
          disabled={
            !mapping['last_name'] || 
            (isAdmin && !selectedAgentId && !agentId)
          }
        >
          Import
        </Button>
      </div>
    </div>
  )}
</div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
};
