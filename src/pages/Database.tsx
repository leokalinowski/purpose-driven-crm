import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Upload, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ContactTable } from '@/components/database/ContactTable';
import { ContactForm } from '@/components/database/ContactForm';
import { ImprovedCSVUpload } from '@/components/database/ImprovedCSVUpload';
import { DNCStatsCard } from '@/components/database/DNCStatsCard';
import { ContactActivitiesDialog } from '@/components/database/ContactActivitiesDialog';
import { DuplicateCleanupButton } from '@/components/admin/DuplicateCleanupButton';
import { DuplicateCleanup } from '@/components/database/DuplicateCleanup';
import { DNCCheckButton } from '@/components/database/DNCCheckButton';
import { DataQualityDashboard } from '@/components/database/DataQualityDashboard';
import { EnrichedContact } from '@/utils/dataEnrichment';

import { useContacts, Contact, ContactInput } from '@/hooks/useContacts';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useAgents } from '@/hooks/useAgents';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Database = () => {
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
    fetchDNCStats,
  } = useDNCStats();
  
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const { agents, fetchAgents, getAgentDisplayName } = useAgents();
  const { generateTasksForNewContacts } = useSphereSyncTasks();

  // Prevent scrolling to top when search changes
  const scrollPositionRef = React.useRef<number>(0);

  const handleSearchNoScroll = React.useCallback((term: string) => {
    scrollPositionRef.current = window.scrollY;
    handleSearch(term);
  }, [handleSearch]);

  // Restore scroll position after search results load
  React.useEffect(() => {
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
  const [selectedCleanupAgent, setSelectedCleanupAgent] = useState<string>('');
  const [showDuplicateCleanup, setShowDuplicateCleanup] = useState(false);

  // Fetch agents for admin cleanup selector
  useEffect(() => {
    if (isAdmin) {
      fetchAgents();
    }
  }, [isAdmin, fetchAgents]);


  const handleAddContact = async (contactData: ContactInput) => {
    try {
      await addContact(contactData);
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      setShowContactForm(false);
      // Refresh DNC stats after adding contact
      await fetchDNCStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive",
      });
    }
  };

  const handleEditContact = async (contactData: Partial<ContactInput>) => {
    if (!editingContact) return;
   
    try {
      await updateContact(editingContact.id, contactData);
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      closeContactForm();
      // Refresh DNC stats after updating contact
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
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      // Refresh DNC stats after deleting contact
      await fetchDNCStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  const handleContactEnriched = async (enrichedContact: EnrichedContact) => {
    try {
      // Convert enriched contact back to ContactInput format
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

      // Refresh contacts list to show updated data
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

      // Refresh contacts list to show updated data
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

  const handleCSVUpload = async (csvData: ContactInput[], agentId?: string) => {
    try {
      console.log('CSV Upload - isAdmin:', isAdmin, 'agentId:', agentId, 'contacts count:', csvData.length);
      
      // For admins: use edge function if uploading to someone else, regular upload for own account
      if (isAdmin && agentId && agentId !== user?.id) {
        console.log('Admin uploading for another agent via edge function:', agentId);
        
        const { data, error } = await supabase.functions.invoke('admin-contacts-import', {
          body: { 
            contacts: csvData, 
            agentId: agentId,
            adminUserId: user?.id 
          }
        });

        if (error) throw error;
        if (!data || data.success !== true) {
          throw new Error(data?.error || 'Import failed.');
        }
        
        console.log('Edge function response:', data);
        
        // Build success message with DNC stats
        let description = data.message || `${data.contactCount ?? csvData.length} contacts uploaded successfully`;
        if (data.dncStats && data.dncStats.checked > 0) {
          description += ` | DNC Check: ${data.dncStats.checked} checked, ${data.dncStats.flagged} flagged`;
          if (data.dncStats.errors > 0) {
            description += ` (${data.dncStats.errors} errors)`;
          }
        }
        
        toast({
          title: 'Success',
          description,
        });
      } else {
        // Regular upload (agents or admins uploading to their own account)
        console.log('Regular upload using uploadCSV hook');
        const insertedContacts = await uploadCSV(csvData);
        
        toast({
          title: 'Success',
          description: `${insertedContacts.length} contacts uploaded successfully`,
        });

        // Refresh the list for the uploading user
        await fetchContacts();

        // Generate tasks for new contacts if they match current week's categories
        await generateTasksForNewContacts(insertedContacts);
      }
      
      setShowCSVUpload(false);
      goToPage(1);
      // Refresh DNC stats after upload
      await fetchDNCStats();
    } catch (error: any) {
      console.error('CSV Upload error:', error);
      
      // Provide more specific error messages for common issues
      let errorMessage = 'Failed to upload contacts';
      if (error?.message?.includes('Duplicate contacts found')) {
        errorMessage = error.message;
      } else if (error?.message?.includes('duplicate key value')) {
        errorMessage = 'Some contacts already exist in the database. Please check for duplicates and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      // Ensure the CSV upload dialog closes even if there's an error
      setShowCSVUpload(false);
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


  // Fetch DNC stats when component mounts
  useEffect(() => {
    fetchDNCStats();
  }, [fetchDNCStats]);

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

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Contact Database</h1>
            <p className="text-muted-foreground">Manage your contacts and leads</p>
          </div>
         
          <div className="flex gap-2">
            {/* Admin Duplicate Cleanup Section */}
            {isAdmin && (
              <div className="flex items-center gap-2 mr-4">
                <Select value={selectedCleanupAgent} onValueChange={setSelectedCleanupAgent}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select agent for cleanup" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {getAgentDisplayName(agent)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCleanupAgent && (
                  <DuplicateCleanupButton
                    agentId={selectedCleanupAgent}
                    agentName={getAgentDisplayName(agents.find(a => a.id === selectedCleanupAgent)!)}
                    onCleanupComplete={() => {
                      // Refresh contacts if cleaned up own account
                      if (selectedCleanupAgent === user?.id) {
                        fetchContacts();
                      }
                      setSelectedCleanupAgent('');
                    }}
                  />
                )}
              </div>
            )}
            
            <Button
              onClick={() => setShowDuplicateCleanup(true)}
              variant="outline"
            >
              <Users className="h-4 w-4 mr-2" />
              Clean Duplicates
            </Button>
            <Button
              onClick={() => setShowCSVUpload(true)}
              variant="outline"
              disabled={isAdmin && !selectedCleanupAgent}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <Button onClick={() => setShowContactForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
        
        {/* DNC Statistics Dashboard */}
        <div className="space-y-4">
          <DNCStatsCard stats={stats} loading={dncLoading} />
          
          {/* DNC Check Buttons - Admin Only */}
          {isAdmin && (
            <div className="flex justify-center gap-4">
              <DNCCheckButton variant="default" size="lg" />
              <DNCCheckButton variant="destructive" size="lg" forceRecheck={true} />
            </div>
          )}
        </div>
        
        {/* Data Quality Dashboard */}
        <DataQualityDashboard
          contacts={allContacts}
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
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => handleSearchNoScroll(e.target.value)}
                className="max-w-sm"
              />
            </div>
            {loading ? (
              <div className="text-center py-8">Loading contacts...</div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <ContactTable
                    contacts={contacts}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onOpenEdit={openEditForm}
                    onDelete={setDeletingContact}
                    onViewActivities={setViewingTouchpointsContact}
                    onEnriched={handleContactEnriched}
                  />
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                   
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                     
                      {generatePageNumbers().map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(page)}
                          className="min-w-[2.5rem]"
                        >
                          {page}
                        </Button>
                      ))}
                     
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
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
        <ImprovedCSVUpload
          open={showCSVUpload}
          onOpenChange={setShowCSVUpload}
          onUpload={handleCSVUpload}
          agentId={isAdmin ? selectedCleanupAgent : user?.id}
        />
        
        {/* Duplicate Cleanup Dialog */}
        {showDuplicateCleanup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Duplicate Contact Cleanup</h2>
                  <Button
                    variant="outline"
                    onClick={() => setShowDuplicateCleanup(false)}
                  >
                    Close
                  </Button>
                </div>
                <DuplicateCleanup />
              </div>
            </div>
          </div>
        )}
        
        {/* Contact Touchpoints Dialog */}
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
      </div>
    </Layout>
  );
};

export default Database;
