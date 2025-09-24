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
import { CSVUpload } from '@/components/database/CSVUpload';
import { DNCStatsCard } from '@/components/database/DNCStatsCard';
import { ContactActivitiesDialog } from '@/components/database/ContactActivitiesDialog';
import { DuplicateCleanupButton } from '@/components/admin/DuplicateCleanupButton';
import { DNCCheckButton } from '@/components/database/DNCCheckButton';

import { useContacts, Contact, ContactInput } from '@/hooks/useContacts';
import { useDNCStats } from '@/hooks/useDNCStats';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useAgents } from '@/hooks/useAgents';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Database = () => {
  const {
    contacts,
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
 
  const [showContactForm, setShowContactForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [viewingActivitiesContact, setViewingActivitiesContact] = useState<Contact | null>(null);
  const [selectedCleanupAgent, setSelectedCleanupAgent] = useState<string>('');

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
        
        toast({
          title: 'Success',
          description: data.message || `${data.contactCount ?? csvData.length} contacts uploaded successfully`,
        });
      } else {
        // Regular upload (agents or admins uploading to their own account)
        console.log('Regular upload using uploadCSV hook');
        await uploadCSV(csvData);
        
        toast({
          title: 'Success',
          description: `${csvData.length} contacts uploaded successfully`,
        });

        // Refresh the list for the uploading user
        await fetchContacts();
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
    let end = Math.min(totalPages, start + maxVisible - 1);
   
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
      <div className="container mx-auto p-6 space-y-6">
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
              onClick={() => setShowCSVUpload(true)}
              variant="outline"
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
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contacts</span>
              <Badge variant="secondary">{contacts.length} contacts</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            {loading ? (
              <div className="text-center py-8">Loading contacts...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <ContactTable
                    contacts={contacts}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    onOpenEdit={openEditForm}
                    onDelete={setDeletingContact}
                    onViewActivities={setViewingActivitiesContact}
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
        <CSVUpload
          open={showCSVUpload}
          onOpenChange={setShowCSVUpload}
          onUpload={handleCSVUpload}
        />
        
        {/* Contact Activities Dialog */}
        {viewingActivitiesContact && (
          <ContactActivitiesDialog
            open={!!viewingActivitiesContact}
            onOpenChange={() => setViewingActivitiesContact(null)}
            contact={viewingActivitiesContact}
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
