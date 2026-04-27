import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Upload, Search, ChevronLeft, ChevronRight, Users, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ContactTable } from '@/components/database/ContactTable';
import { ContactForm } from '@/components/database/ContactForm';
import { ImprovedCSVUpload } from '@/components/database/ImprovedCSVUpload';
import { DNCStatsCard } from '@/components/database/DNCStatsCard';
import { ContactActivitiesDialog } from '@/components/database/ContactActivitiesDialog';
import { DuplicateCleanup } from '@/components/database/DuplicateCleanup';
import { DNCCheckButton } from '@/components/database/DNCCheckButton';
import { DataQualityDashboard } from '@/components/database/DataQualityDashboard';
import { BulkContactEditor } from '@/components/database/BulkContactEditor';
import { EnrichedContact } from '@/utils/dataEnrichment';

import { useContacts, Contact, ContactInput } from '@/hooks/useContacts';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useToast } from '@/components/ui/use-toast';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { supabase } from '@/integrations/supabase/client';

const Database = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { getContactLimit } = useFeatureAccess();
  const contactLimit = getContactLimit();

  const {
    contacts,
    allContacts,
    totalContacts,
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
  } = useContacts();

  const {
    stats,
    loading: dncLoading,
    checking: dncChecking,
    fetchDNCStats,
    triggerDNCCheck,
  } = useDNCStats();

  const handleDNCCheck = async (forceRecheck: boolean) => {
    try {
      await triggerDNCCheck(forceRecheck);
      toast({
        title: 'DNC Check Started',
        description: forceRecheck 
          ? 'Rechecking all contacts against DNC lists. This may take a few minutes.'
          : 'Checking new contacts against DNC lists. This may take a few minutes.',
      });
      setTimeout(() => { fetchDNCStats(); }, 5000);
    } catch (error: any) {
      console.error('DNC check failed:', error);
      toast({
        title: 'DNC Check Failed',
        description: error?.message || 'Failed to start DNC check. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const { toast } = useToast();
  const { generateTasksForNewContacts } = useSphereSyncTasks();

  const scrollPositionRef = useRef<number>(0);

  const handleSearchNoScroll = useCallback((term: string) => {
    scrollPositionRef.current = window.scrollY;
    handleSearch(term);
  }, [handleSearch]);

  useEffect(() => {
    if (!loading && scrollPositionRef.current > 0) {
      const timeoutId = setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
        scrollPositionRef.current = 0;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [loading]);

  const [showContactForm, setShowContactForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [viewingTouchpointsContact, setViewingTouchpointsContact] = useState<Contact | null>(null);
  const [showDuplicateCleanup, setShowDuplicateCleanup] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [showBulkEditor, setShowBulkEditor] = useState(false);

  const isAtLimit = contactLimit != null && totalContacts >= contactLimit;

  const handleExportCSV = useCallback(() => {
    if (!allContacts || allContacts.length === 0) {
      toast({ title: 'No contacts to export', variant: 'destructive' });
      return;
    }
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip Code', 'Tags', 'DNC', 'Notes'];
    const rows = allContacts.map(c => [
      c.first_name || '', c.last_name, c.email || '', c.phone || '',
      c.address_1 || '', c.city || '', c.state || '', c.zip_code || '',
      (c.tags || []).join('; '), c.dnc ? 'Yes' : 'No', (c.notes || '').replace(/"/g, '""'),
    ].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: `Exported ${allContacts.length} contacts.` });
  }, [allContacts, toast]);

  const handleAddContact = async (contactData: ContactInput) => {
    try {
      const newContact = await addContact(contactData, contactLimit);
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      setShowContactForm(false);

      // Fire DNC check for the new contact if it has a valid phone
      if (newContact && contactData.phone && contactData.phone.replace(/\D/g, '').length >= 10) {
        supabase.functions.invoke('dnc-single-check', {
          body: { phone: contactData.phone, contactId: newContact.id }
        }).then(() => {
          console.log('[DNC] Single check completed for new contact');
          fetchDNCStats();
        }).catch(error => {
          console.error('[DNC] Single check failed for new contact:', error);
        });
      }

      await fetchDNCStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to add contact",
        variant: "destructive",
      });
    }
  };

  const handleEditContact = async (contactData: Partial<ContactInput>) => {
    if (!editingContact) return;
   
    try {
      await updateContact(editingContact.id, contactData);
      await fetchContacts();
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      closeContactForm();
      await fetchDNCStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;

    try {
      await deleteContact(deletingContact.id);
      setDeletingContact(null);
      toast({ title: "Success", description: "Contact deleted successfully" });
      await fetchDNCStats();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    }
  };

  const handleContactEnriched = async (enrichedContact: EnrichedContact) => {
    try {
      const contactInput: ContactInput = {
        first_name: enrichedContact.first_name,
        last_name: enrichedContact.last_name,
        phone: enrichedContact.phone,
        email: enrichedContact.email,
        address_1: enrichedContact.address_1,
        address_2: enrichedContact.address_2,
        city: enrichedContact.city,
        state: enrichedContact.state,
        zip_code: enrichedContact.zip_code,
        tags: enrichedContact.tags,
        dnc: enrichedContact.dnc,
        notes: enrichedContact.notes,
      };

      await updateContact(enrichedContact.id, contactInput);
      await fetchContacts();

      toast({
        title: "Contact Updated",
        description: "Contact data has been enriched and saved.",
      });
    } catch (error) {
      console.error('Error updating enriched contact:', error);
      toast({
        title: "Error",
        description: "Failed to save enriched contact data.",
        variant: "destructive",
      });
    }
  };

  const handleBulkContactsEnriched = async (enrichedContacts: EnrichedContact[]) => {
    try {
      const updatePromises = enrichedContacts.map(async (enrichedContact) => {
        const contactInput: ContactInput = {
          first_name: enrichedContact.first_name,
          last_name: enrichedContact.last_name,
          phone: enrichedContact.phone,
          email: enrichedContact.email,
          address_1: enrichedContact.address_1,
          address_2: enrichedContact.address_2,
          city: enrichedContact.city,
          state: enrichedContact.state,
          zip_code: enrichedContact.zip_code,
          tags: enrichedContact.tags,
          dnc: enrichedContact.dnc,
          notes: enrichedContact.notes,
        };
        return updateContact(enrichedContact.id, contactInput);
      });

      await Promise.all(updatePromises);
      await fetchContacts();

      toast({
        title: "Bulk Update Complete",
        description: `${enrichedContacts.length} contacts have been enriched and saved.`,
      });
    } catch (error) {
      console.error('Error updating bulk enriched contacts:', error);
      toast({
        title: "Error",
        description: "Failed to save some enriched contact data.",
        variant: "destructive",
      });
    }
  };

  const handleBulkUpdate = async (updates: Partial<Contact>, contactIds: string[]) => {
    try {
      const updatePromises = contactIds.map(contactId => updateContact(contactId, updates));
      await Promise.all(updatePromises);
      await fetchContacts();
      await fetchDNCStats();
      setSelectedContacts([]);
    } catch (error) {
      console.error('Bulk update error:', error);
      throw error;
    }
  };

  const handleBulkDelete = async (contactIds: string[]) => {
    try {
      const deletePromises = contactIds.map(contactId => deleteContact(contactId));
      await Promise.all(deletePromises);
      await fetchContacts();
      await fetchDNCStats();
      setSelectedContacts([]);
      toast({
        title: "Bulk Delete Complete",
        description: `Successfully deleted ${contactIds.length} contacts.`,
      });
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete some contacts. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleCSVUpload = async (csvData: ContactInput[]) => {
    try {
      const insertedContacts = await uploadCSV(csvData, contactLimit);

      toast({
        title: 'Success',
        description: `${insertedContacts.length} contacts uploaded successfully. DNC checks will run separately.`,
      });

      await fetchContacts();
      await generateTasksForNewContacts(insertedContacts);
      
      setShowCSVUpload(false);
      goToPage(1);
      
      await fetchDNCStats();

      // Trigger DNC check after bulk upload
      if (user?.id) {
        try {
          await triggerDNCCheck(false);
          toast({
            title: 'DNC Check Started',
            description: 'DNC check is running in the background. Contacts will be updated shortly.',
          });
        } catch (dncError: any) {
          console.error('DNC check failed:', dncError);
          // Non-admins won't be able to trigger, which is expected - the monthly cron handles it
        }
      }
    } catch (error: any) {
      console.error('CSV Upload error:', error);
      
      let errorMessage = 'Failed to upload contacts';
      if (error?.message?.includes('Duplicate contacts found')) {
        errorMessage = error.message;
      } else if (error?.message?.includes('duplicate key value')) {
        errorMessage = 'Some contacts already exist in the database. Please check for duplicates and try again.';
      } else if (error?.message?.includes('Contact limit') || error?.message?.includes('contact limit')) {
        errorMessage = error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRecheckContactDNC = async (contact: Contact) => {
    if (!contact.phone) {
      toast({ title: 'No Phone', description: 'Contact has no phone number to check.', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'Checking DNC...', description: `Rechecking ${contact.first_name} ${contact.last_name}` });
      const { data, error } = await supabase.functions.invoke('dnc-single-check', {
        body: { phone: contact.phone, contactId: contact.id }
      });
      if (error) throw error;
      await fetchContacts();
      await fetchDNCStats();
      toast({
        title: data?.isDNC ? '⚠️ DNC Flagged' : '✅ Safe to Call',
        description: `${contact.first_name} ${contact.last_name} has been rechecked.`,
      });
    } catch (error: any) {
      console.error('DNC recheck failed:', error);
      toast({ title: 'Recheck Failed', description: error?.message || 'Failed to recheck contact.', variant: 'destructive' });
    }
  };

  const openEditForm = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const closeContactForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
  };

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
   
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
   
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
   
    return pages;
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading database...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">Database</span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Your sphere of influence.</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your contacts, track interactions, and keep your database clean.
            </p>
            {/* Contact capacity indicator */}
            {contactLimit != null && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isAtLimit ? "destructive" : "secondary"} className="text-xs">
                  {totalContacts} / {contactLimit} contacts
                </Badge>
                {isAtLimit && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Limit reached
                  </span>
                )}
              </div>
            )}
          </div>
         
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 self-start sm:self-auto">
            <div className="flex flex-col sm:flex-row gap-2">
            <Button
                onClick={() => setShowContactForm(true)}
                className="sm:w-auto"
                disabled={isAtLimit}
                title={isAtLimit ? `Contact limit reached (${contactLimit})` : undefined}
            >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Add Contact</span>
                <span className="xs:hidden">Add</span>
            </Button>
            <Button
              onClick={() => setShowCSVUpload(true)}
              variant="outline"
                className="sm:w-auto"
                disabled={isAtLimit}
                title={isAtLimit ? `Contact limit reached (${contactLimit})` : undefined}
            >
              <Upload className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Upload CSV</span>
                <span className="xs:hidden">Upload</span>
            </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setShowDuplicateCleanup(true)}
                variant="outline"
                className="sm:w-auto"
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Clean Duplicates</span>
                <span className="xs:hidden">Clean</span>
            </Button>
            <Button
              onClick={() => setShowBulkEditor(true)}
              disabled={selectedContacts.length === 0}
              variant="outline"
                className="sm:w-auto"
              title="Edit multiple selected contacts at once"
            >
              <Users className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Bulk Edit ({selectedContacts.length})</span>
                <span className="xs:hidden">Bulk ({selectedContacts.length})</span>
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="sm:w-auto"
              title="Download all contacts as CSV"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Export CSV</span>
              <span className="xs:hidden">Export</span>
            </Button>
            </div>
          </div>
        </div>
        
        {/* DNC Statistics Dashboard - Admin Only */}
        {isAdmin && (
          <>
            {dncChecking && (
              <Alert className="border-primary/50 bg-primary/10">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  DNC check in progress. Stats will update automatically when complete.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DNCCheckButton 
                  variant="default" 
                  size="default" 
                  onRun={handleDNCCheck}
                  checking={dncChecking}
                />
                <DNCCheckButton 
                  variant="destructive" 
                  size="default" 
                  forceRecheck={true}
                  onRun={handleDNCCheck}
                  checking={dncChecking}
                />
              </div>
              <DNCStatsCard 
                stats={stats || {
                  totalContacts: 0,
                  dncContacts: 0,
                  nonDncContacts: 0,
                  neverChecked: 0,
                  missingPhone: 0,
                  needsRecheck: 0,
                  lastChecked: null,
                }} 
                loading={dncLoading} 
              />
            </div>
          </>
        )}
        
        {/* DNC Stats (read-only) for non-admins */}
        {!isAdmin && (
          <DNCStatsCard 
            stats={stats || {
              totalContacts: 0,
              dncContacts: 0,
              nonDncContacts: 0,
              neverChecked: 0,
              missingPhone: 0,
              needsRecheck: 0,
              lastChecked: null,
            }} 
            loading={dncLoading} 
          />
        )}
        
        <DataQualityDashboard
          contacts={allContacts || []}
          onBulkEnriched={handleBulkContactsEnriched}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contacts</span>
              <Badge variant="secondary">{totalContacts} contacts</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search by name, email, phone, city, state, address, or tag..."
                value={searchTerm}
                onChange={(e) => handleSearchNoScroll(e.target.value)}
                className="flex-1 sm:max-w-sm"
              />
            </div>
            {loading ? (
              <div className="text-center py-8">Loading contacts...</div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                      <ContactTable
                        contacts={contacts || []}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        onOpenEdit={openEditForm}
                        onDelete={setDeletingContact}
                        onViewActivities={setViewingTouchpointsContact}
                        onEnriched={handleContactEnriched}
                        showSelection={true}
                        selectedContacts={selectedContacts || []}
                        onSelectionChange={setSelectedContacts}
                        isAdmin={isAdmin}
                        onRecheckDNC={isAdmin ? handleRecheckContactDNC : undefined}
                      />
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                      Page {currentPage} of {totalPages}
                    </div>
                   
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { goToPage(currentPage - 1); setSelectedContacts([]); }}
                        disabled={currentPage === 1}
                        className="flex-shrink-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1">Previous</span>
                      </Button>
                     
                      <div className="hidden sm:flex items-center space-x-1">
                      {generatePageNumbers().map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => { goToPage(page); setSelectedContacts([]); }}
                          className="min-w-[2.5rem]"
                        >
                          {page}
                        </Button>
                      ))}
                      </div>

                      <div className="sm:hidden flex items-center space-x-2">
                        <span className="text-sm font-medium px-3 py-1 bg-muted rounded">
                          {currentPage}
                        </span>
                      </div>
                     
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { goToPage(currentPage + 1); setSelectedContacts([]); }}
                        disabled={currentPage === totalPages}
                        className="flex-shrink-0"
                      >
                        <span className="hidden sm:inline mr-1">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <ContactForm
          open={showContactForm}
          onOpenChange={closeContactForm}
          contact={editingContact}
          onSubmit={editingContact ? handleEditContact : handleAddContact}
          title={editingContact ? "Edit Contact" : "Add New Contact"}
        />
        {showCSVUpload && (
          <ImprovedCSVUpload
            open={showCSVUpload}
            onOpenChange={setShowCSVUpload}
            onUpload={handleCSVUpload}
          />
        )}
        
        <Dialog open={showDuplicateCleanup} onOpenChange={setShowDuplicateCleanup}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Duplicate Contact Cleanup</DialogTitle>
            </DialogHeader>
            <DuplicateCleanup onComplete={() => { fetchContacts(); setShowDuplicateCleanup(false); }} />
          </DialogContent>
        </Dialog>
        
        {viewingTouchpointsContact && (
          <ContactActivitiesDialog
            open={!!viewingTouchpointsContact}
            onOpenChange={() => setViewingTouchpointsContact(null)}
            contact={viewingTouchpointsContact}
          />
        )}
        
        <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingContact?.first_name} {deletingContact?.last_name}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContact} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BulkContactEditor
          open={showBulkEditor}
          onOpenChange={setShowBulkEditor}
          selectedContacts={selectedContacts}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
        />
      </div>
    </Layout>
  );
};

export default Database;
