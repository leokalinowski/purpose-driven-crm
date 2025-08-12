import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ContactTable } from '@/components/database/ContactTable';
import { ContactForm } from '@/components/database/ContactForm';
import { CSVUpload } from '@/components/database/CSVUpload';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useToast } from '@/hooks/use-toast';

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
  } = useContacts();

  const { toast } = useToast();
  
  const [showContactForm, setShowContactForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  const handleAddContact = async (contactData: any) => {
    try {
      await addContact(contactData);
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      setShowContactForm(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive",
      });
    }
  };

  const handleEditContact = async (contactData: any) => {
    if (!editingContact) return;
    
    try {
      await updateContact(editingContact.id, contactData);
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      closeContactForm();
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  const handleCSVUpload = async (csvData: any[]) => {
    try {
      await uploadCSV(csvData);
      toast({
        title: "Success",
        description: `${csvData.length} contacts uploaded successfully`,
      });
      setShowCSVUpload(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload contacts",
        variant: "destructive",
      });
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
                <ContactTable
                  contacts={contacts}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onEdit={openEditForm}
                  onDelete={setDeletingContact}
                />

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