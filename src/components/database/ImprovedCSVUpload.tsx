import { useState, useCallback, useMemo, useEffect } from 'react';
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
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

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
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  // Set up agent selection when dialog opens
  useEffect(() => {
    if (open) {
      if (isAdmin && !roleLoading) {
        if (agentId) {
          // Use agent from header selector (no need to fetch agents)
          console.log('[CSV Upload] Using pre-selected agent from header:', agentId);
          setSelectedAgentId(agentId);
        } else {
          // No header agent selected, show dropdown in modal
          console.log('[CSV Upload] No header agent, fetching agents for dropdown...');
          setSelectedAgentId('');
          fetchAgents();
        }
      } else if (!isAdmin && !roleLoading) {
        // For agents, always use their own ID
        setSelectedAgentId(user?.id || '');
      }
    } else {
      resetState();
    }
  }, [open, isAdmin, roleLoading, user?.id, agentId, resetState, fetchAgents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (loading) return;
    
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
      const text = await file.text();
      
      setUploadProgress({ stage: 'parsing', progress: 50, message: 'Analyzing CSV structure...' });
      
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing errors:', results.errors);
          }
          
          const newHeaders = Object.keys(results.data[0] || {});
          setRawRows(results.data);
          setHeaders(newHeaders);
          
          // Auto-map headers
          const autoMapping: Record<string, string> = {};
          newHeaders.forEach(header => {
            const field = ALL_FIELDS.find(f => 
              f.label.toLowerCase().includes(header.toLowerCase()) ||
              header.toLowerCase().includes(f.key.replace('_', ' '))
            );
            if (field) {
              autoMapping[field.key] = header;
            }
          });
          setMapping(autoMapping as any);
          
          setUploadProgress({ stage: 'parsing', progress: 100, message: 'CSV parsed successfully' });
        }
      });
      
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to read CSV file',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }, [loading, ALL_FIELDS]);

  const processContacts = useCallback(async () => {
    if (loading || rawRows.length === 0) return;
    
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
      
      const targetAgentId = selectedAgentId || agentId;
      if (!targetAgentId) {
        toast({ title: 'Error', description: 'Unable to determine target agent for import.' });
        return;
      }

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
      
      if (duplicateGroups.length > 0) {
        setShowDuplicateResolution(true);
      } else {
        await proceedWithUpload(unique, targetAgentId);
      }

    } catch (error) {
      console.error('Contact processing error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process contacts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }, [loading, rawRows, mapping, selectedAgentId, agentId]);

  const checkDatabaseDuplicates = async (contacts: ContactInputType[], agentId: string) => {
    const normalized = contacts.map(normalizeContact);
    const dbDuplicates: Array<{ contact: ContactInputType; reason: string }> = [];

    // Check in batches to avoid query limits
    const batchSize = 50;
    for (let i = 0; i < normalized.length; i += batchSize) {
      const batch = normalized.slice(i, i + batchSize);
      
      const emails = batch.filter(c => c.normalized_email).map(c => c.normalized_email!);
      const phones = batch.filter(c => c.normalized_phone).map(c => c.normalized_phone!);
      
      if (emails.length > 0 || phones.length > 0) {
        const orConditions = [
          ...emails.map(email => `email.eq.${email}`),
          ...phones.map(phone => `phone.eq.${phone}`)
        ];
        
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('id, email, phone, first_name, last_name')
          .eq('agent_id', agentId)
          .or(orConditions.join(','));
        
        if (existingContacts) {
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
      }
    }
    
    return dbDuplicates;
  };

  const proceedWithUpload = async (contacts: ContactInputType[], targetAgentId: string) => {
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
        
        // Update progress to indicate DNC checking
        setUploadProgress({ stage: 'uploading', progress: 50, message: 'Contacts uploaded, running DNC checks...' });
        
        await onUpload(formattedContacts, targetAgentId);
      }
      
      setUploadProgress({ stage: 'complete', progress: 100, message: `Successfully uploaded ${contacts.length} contacts` });
      
      const timeout = setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 2000);
      setTimeoutId(timeout);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload contacts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const handleDuplicateResolution = async () => {
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
  };

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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFile(file);
                      handleFileUpload(file);
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
