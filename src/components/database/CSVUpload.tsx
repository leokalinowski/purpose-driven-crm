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
  const [step, setStep] = useState<'upload' | 'delimiter-select' | 'map'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string>('__self__');
  const [selectedDelimiter, setSelectedDelimiter] = useState<string>(',');
  const [originalText, setOriginalText] = useState<string>('');

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
      setSelectedDelimiter(',');
      setOriginalText('');
      setLoading(false);
      setDragActive(false);
    } else if (open && isAdmin && !roleLoading) {
      fetchAgents();
    }
  }, [open, isAdmin, roleLoading, fetchAgents]);

  const handleDelimiterSelection = useCallback(async () => {
    if (!originalText) return;
    
    setLoading(true);
    try {
      console.debug(`[CSVUpload] Re-parsing with selected delimiter: ${selectedDelimiter}`);
      
      const result = Papa.parse(originalText, {
        header: true,
        skipEmptyLines: true,
        delimiter: selectedDelimiter === 'tab' ? '\t' : selectedDelimiter,
      });

      if (result.errors.some(e => e.type === 'Delimiter' || e.type === 'Quotes')) {
        throw new Error('Invalid delimiter for this file format');
      }

      const rows = (result.data as any[]).filter((r) => r && Object.keys(r).length > 0);
      const headers = (result.meta.fields || Object.keys(rows[0] || {})) as string[];

      if (headers.length <= 1) {
        throw new Error('Still only one column after delimiter selection. Please check your file format.');
      }

      setCsvHeaders(headers);
      setRawRows(rows);
      
      // Set up default mapping
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');
      const canonicalize = (s: string) => {
        const nh = normalize(s);
        if (nh === 'phone_number') return 'phone';
        if (nh === 'zipcode' || nh === 'zip') return 'zip_code';
        if (nh === 'firstname' || nh === 'first') return 'first_name';
        if (nh === 'lastname' || nh === 'last') return 'last_name';
        return nh;
      };

      const defaultMap: Record<string, string> = {};
      ALL_FIELDS.forEach((field) => {
        const match = headers.find((h: string) => {
          const ch = canonicalize(h);
          return ch === field;
        });
        if (match) defaultMap[field] = match;
      });
      
      setMapping(defaultMap);
      setStep('map');
    } catch (error: any) {
      console.error('Delimiter selection error:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to parse with selected delimiter' });
    } finally {
      setLoading(false);
    }
  }, [originalText, selectedDelimiter, ALL_FIELDS]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (loading) return;
    
    setLoading(true);
    try {
      if (!agentId) {
        toast({ title: 'Error', description: 'Please log in to upload contacts.' });
        onOpenChange(false);
        return;
      }

      const rawText = await file.text();
      let text = rawText.replace(/^\uFEFF/, '');
      setOriginalText(text);

      // Drop bogus first line like "sep=,"
      const lines = text.split(/\r?\n/);
      if (lines[0] && /^sep\s*=/.test(lines[0].trim().toLowerCase())) {
        lines.shift();
        text = lines.join('\n');
      }

      const delimiters = [',', ';', '\t', '|'];
      let bestResult = Papa.parse(text, { header: true, skipEmptyLines: true });

      let rows = (bestResult.data as any[]).filter((r) => r && Object.keys(r).length > 0);
      let headers = (bestResult.meta.fields || Object.keys(rows[0] || {})) as string[];

      if (!headers || headers.length <= 1) {
        console.debug('[CSVUpload] Single column detected, showing delimiter selection UI');
        setCsvHeaders(['__single_column__']);
        setRawRows([]);
        setStep('delimiter-select');
        return;
      }

      if (rows.length === 0) {
        throw new Error('No data rows found in CSV file.');
      }

      setCsvHeaders(headers);
      setRawRows(rows);
      
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');
      const canonicalize = (s: string) => {
        const nh = normalize(s);
        if (nh === 'phone_number') return 'phone';
        if (nh === 'zipcode' || nh === 'zip') return 'zip_code';
        if (nh === 'firstname' || nh === 'first') return 'first_name';
        if (nh === 'lastname' || nh === 'last') return 'last_name';
        return nh;
      };

      const defaultMap: Record<string, string> = {};
      ALL_FIELDS.forEach((field) => {
        const match = headers.find((h: string) => {
          const ch = canonicalize(h);
          return ch === field;
        });
        if (match) defaultMap[field] = match;
      });

      setMapping(defaultMap);
      setStep('map');
    } catch (error: any) {
      console.error('CSV parsing error:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to read CSV file.' });
    } finally {
      setLoading(false);
    }
  }, [loading, agentId, onOpenChange, ALL_FIELDS]);

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
        toast({ title: 'Error', description: 'No valid contacts found.' });
        return;
      }

      const targetAgentId = isAdmin
        ? (selectedAgentId === '__self__' || !selectedAgentId ? agentId : selectedAgentId)
        : agentId;

      if (onUpload) {
        await onUpload(contacts, targetAgentId);
      } else {
        const contactsForDb = contacts.map((contact) => ({
          ...contact,
          agent_id: targetAgentId,
          category: contact.last_name.charAt(0).toUpperCase() || 'U',
        }));
        const { error } = await supabase.from('contacts').insert(contactsForDb);
        if (error) throw error;
      }
      
      toast({ title: 'Success', description: `${contacts.length} contacts imported!` });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Import failed:', error);
      toast({ title: 'Error', description: error?.message || 'Import failed.' });
    }
  }, [rawRows, mapping, isAdmin, selectedAgentId, agentId, onUpload, onOpenChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const downloadTemplate = useCallback(() => {
    const headers = ['first_name','last_name','phone','email','address_1','address_2','city','state','zip_code','tags','dnc','notes'];
    const csvContent = headers.join(',') + '\n' + 'John,Doe,555-1234,john@example.com,123 Main St,,Anytown,CA,12345,client;prospect,false,Sample note';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const renderContent = () => {
    if (step === 'delimiter-select') {
      return (
        <div className="space-y-6">
          <div>
            <h4 className="font-medium">Select Delimiter</h4>
            <p className="text-sm text-muted-foreground">
              Only one column was detected. Please select the correct delimiter for your CSV file.
            </p>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">Delimiter</label>
            <Select value={selectedDelimiter} onValueChange={setSelectedDelimiter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma (,)</SelectItem>
                <SelectItem value=";">Semicolon (;)</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="|">Pipe (|)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button onClick={handleDelimiterSelection} disabled={loading}>
              {loading ? 'Processing...' : 'Continue'}
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'upload') {
      return (
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
                    {!agentsLoading && agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {getAgentDisplayName(agent)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </>
      );
    }

    // Mapping step
    return (
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
            disabled={!mapping['last_name'] || (isAdmin && !selectedAgentId && !agentId)}
          >
            Import
          </Button>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Contacts CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple contacts at once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
};