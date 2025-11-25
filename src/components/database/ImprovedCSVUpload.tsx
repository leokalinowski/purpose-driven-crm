import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Upload, Download, Users, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ContactInput } from '@/hooks/useContacts';
import { useAgents } from '@/hooks/useAgents';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  normalizeContact, 
  findDuplicatesInList, 
  mergeContacts, 
  validateContact,
  ContactInput as ContactInputType,
  NormalizedContact
} from '@/utils/contactUtils';

interface CSVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload?: (contacts: ContactInput[], agentId?: string) => Promise<void>;
  agentId?: string;
}

interface UploadProgress {
  stage: 'parsing' | 'validating' | 'checking_duplicates' | 'uploading' | 'complete';
  progress: number;
  message: string;
}

interface DuplicateGroup {
  original: ContactInputType;
  duplicates: ContactInputType[];
  reason: string;
  action: 'keep_original' | 'merge' | 'skip_all';
}

// Move ALL_FIELDS outside component to prevent recreation on every render
const ALL_FIELDS: Array<{ key: keyof ContactInput; label: string; required: boolean }> = [
  { key: 'first_name', label: 'First Name', required: false },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'address_1', label: 'Address 1', required: false },
  { key: 'address_2', label: 'Address 2', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'zip_code', label: 'ZIP Code', required: false },
  { key: 'tags', label: 'Tags (comma-separated)', required: false },
  { key: 'dnc', label: 'Do Not Call', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

export const ImprovedCSVUpload = ({ 
  open, 
  onOpenChange, 
  onUpload, 
  agentId 
}: CSVUploadProps) => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { agents, loading: agentsLoading, fetchAgents } = useAgents();
  
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<keyof ContactInput, string>>({} as any);
  const [loading, setLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [autoParseText, setAutoParseText] = useState(true);
  const [guessDelimiter, setGuessDelimiter] = useState(true);
  
  // New state for improved processing
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; errors: string[] }>>([]);
  const [processedContacts, setProcessedContacts] = useState<ContactInputType[]>([]);
  const [showDuplicateResolution, setShowDuplicateResolution] = useState(false);
  
  // Use ref for timeoutId to avoid dependency issues
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Reset all state when dialog closes
  const resetState = useCallback(() => {
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setMapping({} as any);
    setLoading(false);
    setSelectedAgentId('');
    setUploadProgress(null);
    setDuplicateGroups([]);
    setValidationErrors([]);
    setProcessedContacts([]);
    setShowDuplicateResolution(false);
    
    // Clear any pending timeouts
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  // Set up agent selection when dialog opens
  useEffect(() => {
    if (open) {
      if (isAdmin && !roleLoading) {
        if (agentId) {
          // Use agent from header selector (no need to fetch agents)
          setSelectedAgentId(agentId);
        } else {
          // No header agent selected, show dropdown in modal
          setSelectedAgentId('');
          fetchAgents();
        }
      } else if (!isAdmin && !roleLoading) {
        // For agents, always use their own ID
        setSelectedAgentId(user?.id || '');
      }
    } else {
      // Reset state when dialog closes
      setFile(null);
      setRawRows([]);
      setHeaders([]);
      setMapping({} as any);
      setLoading(false);
      setSelectedAgentId('');
      setUploadProgress(null);
      setDuplicateGroups([]);
      setValidationErrors([]);
      setProcessedContacts([]);
      setShowDuplicateResolution(false);
    }
  }, [open, isAdmin, roleLoading, user?.id, agentId, fetchAgents]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    // Prevent multiple simultaneous uploads
    if (loading) {
      return;
    }

    // Validate file
    if (!file) {
      toast({
        title: 'Error',
        description: 'No file selected',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (20MB limit)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: 'File is too large. Maximum size is 20MB.',
        variant: 'destructive'
      });
      return;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
      return;
    }
    
    // Reset state for new upload
    setFile(file);
    setRawRows([]);
    setHeaders([]);
    setMapping({} as any);
    setDuplicateGroups([]);
    setValidationErrors([]);
    setProcessedContacts([]);
    setShowDuplicateResolution(false);
    
    setLoading(true);
    setUploadProgress({ stage: 'parsing', progress: 0, message: 'Parsing CSV file...' });
    
    try {
      // Read file text
      const text = await file.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('File is empty');
      }
      
      if (!isMountedRef.current) {
        return; // Component unmounted, don't update state
      }
      
      setUploadProgress({ stage: 'parsing', progress: 50, message: 'Analyzing CSV structure...' });
      
      // Use Papa.parse synchronously and handle results immediately
      let results;
      try {
        results = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });
      } catch (parseError) {
        throw new Error(`Failed to parse CSV: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      if (!isMountedRef.current) {
        return; // Component unmounted, don't update state
      }
      
      if (results.errors.length > 0) {
        console.warn('CSV parsing errors:', results.errors);
      }
      
      const data = results.data || [];
      if (data.length === 0) {
        toast({
          title: 'Error',
          description: 'CSV file appears to be empty or has no valid rows',
          variant: 'destructive'
        });
        setLoading(false);
        setUploadProgress(null);
        return;
      }
      
      // Validate that we have headers
      const firstRow = data[0];
      if (!firstRow || typeof firstRow !== 'object') {
        throw new Error('CSV file does not have valid headers');
      }
      
      const newHeaders = Object.keys(firstRow);
      if (newHeaders.length === 0) {
        throw new Error('CSV file does not have any columns');
      }
      
      if (!isMountedRef.current) {
        return; // Component unmounted, don't update state
      }
      
      setRawRows(data);
      setHeaders(newHeaders);
      
      // Auto-map headers
      const autoMapping: Record<string, string> = {};
      newHeaders.forEach(header => {
        if (header && typeof header === 'string') {
          const field = ALL_FIELDS.find(f => 
            f.label.toLowerCase().includes(header.toLowerCase()) ||
            header.toLowerCase().includes(f.key.replace('_', ' '))
          );
          if (field) {
            autoMapping[field.key] = header;
          }
        }
      });
      setMapping(autoMapping as any);
      
      if (!isMountedRef.current) {
        return; // Component unmounted, don't update state
      }
      
      setUploadProgress({ stage: 'parsing', progress: 100, message: 'CSV parsed successfully' });
      
      // Clear progress after a delay, but only if component is still mounted
      const progressTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          setUploadProgress(null);
        }
      }, 2000);
      timeoutIdRef.current = progressTimeout;
      
    } catch (error) {
      console.error('File upload error:', error);
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read CSV file';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
        setLoading(false);
        setUploadProgress(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [loading]);

  const processContacts = useCallback(async () => {
    // Prevent multiple simultaneous processing
    if (loading || rawRows.length === 0) {
      return;
    }
    
    // Ensure agent is selected
    const targetAgentId = selectedAgentId || agentId;
    if (!targetAgentId) {
      toast({
        title: 'Error',
        description: 'Please select a target agent before processing contacts',
        variant: 'destructive'
      });
      return;
    }
    
    if (!isMountedRef.current) {
      return; // Component unmounted
    }
    
    setLoading(true);
    setUploadProgress({ stage: 'validating', progress: 0, message: 'Validating contact data...' });
    
    try {
      // Step 1: Parse and validate contacts
      const contacts: ContactInputType[] = [];
      const errors: Array<{ row: number; errors: string[] }> = [];
      
      rawRows.forEach((row: any, index: number) => {
        const normalize = (v: any) => (v == null ? '' : String(v));
        const getVal = (field: keyof ContactInput) => {
          const header = mapping[field];
          if (!header || header === '__ignore__') return '';
          return normalize(row[header]);
        };

        const last_name = getVal('last_name');
        if (!last_name) {
          errors.push({ row: index + 1, errors: ['Last name is required'] });
          return;
        }

        const tagsRaw = getVal('tags');
        const tags = tagsRaw
          ? tagsRaw.split(/[;,]/).map((t: string) => t.trim()).filter(Boolean)
          : null;
        const dncRaw = getVal('dnc').toLowerCase();
        const dnc = ['true', '1', 'yes', 'y'].includes(dncRaw);

        const contact: ContactInputType = {
          first_name: getVal('first_name'),
          last_name,
          phone: getVal('phone'),
          email: getVal('email'),
          address_1: getVal('address_1'),
          address_2: getVal('address_2'),
          city: getVal('city'),
          state: getVal('state'),
          zip_code: getVal('zip_code'),
          tags,
          dnc,
          notes: getVal('notes'),
        };

        const validation = validateContact(contact);
        if (!validation.isValid) {
          errors.push({ row: index + 1, errors: validation.errors });
          return;
        }

        contacts.push(contact);
      });

      setValidationErrors(errors);
      setUploadProgress({ stage: 'validating', progress: 50, message: `Validated ${contacts.length} contacts, ${errors.length} errors found` });

      if (contacts.length === 0) {
        toast({ title: 'Error', description: 'No valid contacts found after validation.' });
        return;
      }

      // Step 2: Check for duplicates within the CSV
      setUploadProgress({ stage: 'checking_duplicates', progress: 0, message: 'Checking for duplicates...' });
      
      const { unique, duplicates } = findDuplicatesInList(contacts);
      
      setUploadProgress({ stage: 'checking_duplicates', progress: 50, message: `Found ${duplicates.length} duplicate groups` });

      // Step 3: Check for duplicates in database
      setUploadProgress({ stage: 'checking_duplicates', progress: 75, message: 'Checking against existing database...' });
      
      // Check database duplicates
      const dbDuplicates = await checkDatabaseDuplicates(unique, targetAgentId);
      
      setUploadProgress({ stage: 'checking_duplicates', progress: 100, message: 'Duplicate check complete' });

      // Prepare for duplicate resolution
      const duplicateGroups: DuplicateGroup[] = [
        ...duplicates.map(d => ({
          original: d.original,
          duplicates: d.duplicates,
          reason: d.reason,
          action: 'keep_original' as const
        })),
        ...dbDuplicates.map(d => ({
          original: d.contact,
          duplicates: [],
          reason: `Database duplicate: ${d.reason}`,
          action: 'skip_all' as const
        }))
      ];

      setDuplicateGroups(duplicateGroups);
      setProcessedContacts(unique);
      
      if (!isMountedRef.current) {
        return; // Component unmounted
      }

      if (duplicateGroups.length > 0) {
        setShowDuplicateResolution(true);
      } else {
        await proceedWithUpload(unique, targetAgentId);
      }

    } catch (error) {
      console.error('Contact processing error:', error);
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process contacts';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
        setLoading(false);
        setUploadProgress(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setUploadProgress(null);
      }
    }
  }, [loading, rawRows, mapping, selectedAgentId, agentId]);

  const checkDatabaseDuplicates = async (contacts: ContactInputType[], agentId: string) => {
    const normalized = contacts.map(normalizeContact);
    const dbDuplicates: Array<{ contact: ContactInputType; reason: string }> = [];

    try {
      // Check in batches to avoid query limits (reduced from 50 to 25)
      const batchSize = 25;
      for (let i = 0; i < normalized.length; i += batchSize) {
        const batch = normalized.slice(i, i + batchSize);
        
        const emails = batch.filter(c => c.normalized_email).map(c => c.normalized_email!);
        const phones = batch.filter(c => c.normalized_phone).map(c => c.normalized_phone!);
        
        // Skip empty batches
        if (emails.length === 0 && phones.length === 0) {
          continue;
        }

        // Use separate .in() queries instead of .or() to avoid URL length limits
        const existingContactsMap = new Map<string, any>();

        // Query 1: Check emails
        if (emails.length > 0) {
          const { data: emailMatches, error: emailError } = await supabase
            .from('contacts')
            .select('id, email, phone, first_name, last_name')
            .eq('agent_id', agentId)
            .in('email', emails);
          
          if (emailError) {
            console.error('Email duplicate check error:', emailError);
            throw emailError;
          }

          emailMatches?.forEach(c => existingContactsMap.set(c.id, c));
        }

        // Query 2: Check phones
        if (phones.length > 0) {
          const { data: phoneMatches, error: phoneError } = await supabase
            .from('contacts')
            .select('id, email, phone, first_name, last_name')
            .eq('agent_id', agentId)
            .in('phone', phones);
          
          if (phoneError) {
            console.error('Phone duplicate check error:', phoneError);
            throw phoneError;
          }

          phoneMatches?.forEach(c => existingContactsMap.set(c.id, c));
        }

        // Check for duplicates in merged results
        const existingContacts = Array.from(existingContactsMap.values());
        batch.forEach(contact => {
          const existing = existingContacts.find(e => 
            e.email === contact.normalized_email || 
            e.phone === contact.normalized_phone
          );
          
          if (existing) {
            dbDuplicates.push({
              contact: contacts[i + batch.indexOf(contact)],
              reason: `Existing: ${existing.first_name} ${existing.last_name}`
            });
          }
        });
      }
    } catch (error) {
      console.error('Database duplicate check failed:', error);
      toast({
        title: 'Duplicate Check Error',
        description: 'Failed to check for existing contacts. Please try again with a smaller file.',
        variant: 'destructive'
      });
      throw error;
    }
    
    return dbDuplicates;
  };

  const proceedWithUpload = useCallback(async (contacts: ContactInputType[], targetAgentId: string) => {
    if (!isMountedRef.current) {
      return; // Component unmounted
    }

    setUploadProgress({ stage: 'uploading', progress: 0, message: 'Uploading contacts...' });
    
    try {
      if (onUpload) {
        // Convert to match useContacts ContactInput type
        const formattedContacts = contacts.map(c => ({
          first_name: c.first_name || '',
          last_name: c.last_name,
          phone: c.phone,
          email: c.email,
          address_1: c.address_1,
          address_2: c.address_2,
          city: c.city,
          state: c.state,
          zip_code: c.zip_code,
          tags: c.tags,
          notes: c.notes,
          dnc: c.dnc || false
        }));
        
        // Upload contacts first - NO DNC checks during upload
        setUploadProgress({ stage: 'uploading', progress: 50, message: 'Saving contacts to database...' });
        
        await onUpload(formattedContacts, targetAgentId);
        
        // Upload complete - DNC checks will be triggered separately by the parent component
        if (isMountedRef.current) {
          setUploadProgress({ stage: 'uploading', progress: 100, message: `Successfully saved ${contacts.length} contacts` });
        }
      }
      
      if (!isMountedRef.current) {
        return; // Component unmounted
      }
      
      setUploadProgress({ stage: 'complete', progress: 100, message: `Successfully uploaded ${contacts.length} contacts. DNC checks will run separately.` });
      
      // Clear previous timeout if exists
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      
      // Set timeout to close dialog after success
      timeoutIdRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          onOpenChange(false);
          // Reset state inline to avoid dependency issues
          setFile(null);
          setRawRows([]);
          setHeaders([]);
          setMapping({} as any);
          setLoading(false);
          setSelectedAgentId('');
          setUploadProgress(null);
          setDuplicateGroups([]);
          setValidationErrors([]);
          setProcessedContacts([]);
          setShowDuplicateResolution(false);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload contacts';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
        setLoading(false);
        setUploadProgress(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setUploadProgress(null);
      }
    }
  }, [onUpload, onOpenChange]);

  const handleDuplicateResolution = useCallback(async () => {
    if (loading) {
      return; // Prevent multiple clicks
    }

    if (!isMountedRef.current) {
      return; // Component unmounted
    }

    const finalContacts: ContactInputType[] = [];
    
    // Process each duplicate group based on user action
    duplicateGroups.forEach(group => {
      if (group.action === 'keep_original') {
        finalContacts.push(group.original);
      } else if (group.action === 'merge') {
        const merged = group.duplicates.reduce((acc, dup) => mergeContacts(acc, dup), group.original);
        finalContacts.push(merged);
      }
      // Skip 'skip_all' - don't add to final contacts
    });
    
    // Add unique contacts
    finalContacts.push(...processedContacts);
    
    const targetAgentId = selectedAgentId || agentId;
    if (targetAgentId) {
      await proceedWithUpload(finalContacts, targetAgentId);
    }
  }, [loading, duplicateGroups, processedContacts, selectedAgentId, agentId, proceedWithUpload]);

  const downloadTemplate = () => {
    const headers = ALL_FIELDS.map(f => f.label);
    const sampleData = ['John', 'Doe', '555-123-4567', 'john@example.com', '123 Main St', '', 'Anytown', 'CA', '12345', 'lead,hot', 'false', 'Sample contact'];
    
    const csvContent = [headers, sampleData].map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contact_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Contacts from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import contacts. The system will automatically detect and help you resolve duplicates.
          </DialogDescription>
        </DialogHeader>

        {!showDuplicateResolution ? (
          <div className="space-y-6">
            {/* File Upload */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv"
                  disabled={loading}
                  onChange={async (e) => {
                    try {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleFileUpload(file);
                        // Reset input to allow re-upload of same file
                        e.target.value = '';
                      }
                    } catch (error) {
                      console.error('File input error:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to process file selection',
                        variant: 'destructive'
                      });
                    }
                  }}
                  className="flex-1"
                />
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            {/* Progress Indicator */}
            {uploadProgress && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{uploadProgress.message}</span>
                      <span>{uploadProgress.progress}%</span>
                    </div>
                    <Progress value={uploadProgress.progress} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{validationErrors.length} contacts have validation errors:</strong>
                  <ul className="mt-2 list-disc list-inside">
                    {validationErrors.slice(0, 5).map((error, index) => (
                      <li key={index}>
                        Row {error.row}: {error.errors.join(', ')}
                      </li>
                    ))}
                    {validationErrors.length > 5 && (
                      <li>... and {validationErrors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Field Mapping */}
            {headers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Map CSV Columns</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ALL_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <Select
                        value={mapping[field.key] || '__ignore__'}
                        onValueChange={(value) => {
                          setMapping(prev => ({ ...prev, [field.key]: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">Ignore</SelectItem>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Selection (Admin only - only show if no header agent) */}
            {isAdmin && !roleLoading && !agentId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Target Agent <span className="text-destructive">*</span>
                </label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={agentsLoading}>
                  <SelectTrigger className="border-2 border-primary/20">
                    <SelectValue placeholder={agentsLoading ? "Loading agents..." : "Select agent (required)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.user_id} value={agent.user_id}>
                        {agent.first_name} {agent.last_name} ({agent.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgentId && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    Ready to upload to {agents.find(a => a.user_id === selectedAgentId)?.first_name} {agents.find(a => a.user_id === selectedAgentId)?.last_name}
                  </p>
                )}
              </div>
            )}
            
            {/* Show confirmation when agent is pre-selected from header */}
            {isAdmin && !roleLoading && agentId && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Contacts will be uploaded to: <strong>{agents.find(a => a.user_id === agentId)?.first_name} {agents.find(a => a.user_id === agentId)?.last_name || 'Selected Agent'}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={processContacts} 
                disabled={loading || rawRows.length === 0 || !(selectedAgentId || agentId)}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {loading ? 'Processing...' : 'Process Contacts'}
              </Button>
            </div>
          </div>
        ) : (
          /* Duplicate Resolution Interface */
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Resolve Duplicates</h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Found {duplicateGroups.length} groups of potential duplicates. Choose how to handle each group:
            </p>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {duplicateGroups.map((group, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {group.original.first_name} {group.original.last_name}
                      </CardTitle>
                      <Badge variant="outline">{group.reason}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      <p><strong>Original:</strong> {group.original.email || 'No email'} | {group.original.phone || 'No phone'}</p>
                      {group.duplicates.map((dup, i) => (
                        <p key={i}><strong>Duplicate {i + 1}:</strong> {dup.email || 'No email'} | {dup.phone || 'No phone'}</p>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={group.action === 'keep_original' ? 'default' : 'outline'}
                        onClick={() => setDuplicateGroups(prev => 
                          prev.map((g, i) => i === index ? { ...g, action: 'keep_original' } : g)
                        )}
                      >
                        Keep Original
                      </Button>
                      <Button
                        size="sm"
                        variant={group.action === 'merge' ? 'default' : 'outline'}
                        onClick={() => setDuplicateGroups(prev => 
                          prev.map((g, i) => i === index ? { ...g, action: 'merge' } : g)
                        )}
                      >
                        Merge All
                      </Button>
                      <Button
                        size="sm"
                        variant={group.action === 'skip_all' ? 'destructive' : 'outline'}
                        onClick={() => setDuplicateGroups(prev => 
                          prev.map((g, i) => i === index ? { ...g, action: 'skip_all' } : g)
                        )}
                      >
                        Skip All
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDuplicateResolution(false)}>
                Back
              </Button>
              <Button onClick={handleDuplicateResolution} disabled={loading}>
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Proceed with Upload
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
