import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Search, UserX, Mail, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  profile_exists: boolean;
  profile_id?: string;
  current_role?: string;
}

const ROLE_OPTIONS = [
  { value: 'core', label: 'Core ($149/mo)' },
  { value: 'managed', label: 'Managed ($449/mo)' },
  { value: 'agent', label: 'Agent (DFY Premium)' },
  { value: 'admin', label: 'Admin' },
] as const;

export const UserManagement = () => {
  const [searchEmail, setSearchEmail] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const searchUser = async () => {
    if (!searchEmail) {
      toast({
        title: 'Email required',
        description: 'Please enter an email to search',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Search in profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, created_at')
        .eq('email', searchEmail)
        .maybeSingle();

      if (profileError || !profileData) {
        toast({
          title: 'User not found',
          description: `No user found with email: ${searchEmail}`,
          variant: 'destructive',
        });
        setUserData(null);
        return;
      }

      // Get role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileData.user_id)
        .order('role')
        .limit(1)
        .maybeSingle();

      setUserData({
        id: profileData.user_id,
        email: profileData.email || searchEmail,
        created_at: profileData.created_at,
        email_confirmed_at: null,
        profile_exists: true,
        profile_id: profileData.user_id,
        current_role: roleData?.role || 'agent',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to search for user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async () => {
    if (!userData) return;

    setLoading(true);
    try {
      // First delete profile if exists
      if (userData.profile_exists) {
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('user_id', userData.id);

        if (profileError) {
          console.warn('Profile deletion warning:', profileError);
        }
      }

      // Delete from auth.users requires admin privileges
      // This would typically be done via an edge function with service role key
      const { error: deleteError } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: userData.id },
      });

      if (deleteError) {
        throw deleteError;
      }

      toast({
        title: 'User deleted',
        description: `Successfully deleted user: ${userData.email}`,
      });

      setUserData(null);
      setSearchEmail('');
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user. You may need admin privileges.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Search and manage user accounts. Use this to delete test accounts for training videos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="searchEmail">Search by Email</Label>
              <Input
                id="searchEmail"
                type="email"
                placeholder="user@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    searchUser();
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={searchUser} disabled={loading} className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>

          {userData && (
            <Card className="border-2">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{userData.email}</span>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{format(new Date(userData.created_at), 'PPP')}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Profile Status:</span>
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">User ID:</span>
                        <span className="text-xs font-mono">{userData.id}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-muted-foreground">Role / Tier:</span>
                        <Select
                          value={userData.current_role || 'agent'}
                          onValueChange={async (newRole) => {
                            try {
                              // Delete existing roles and insert new one
                              await supabase
                                .from('user_roles')
                                .delete()
                                .eq('user_id', userData.id);
                              
                              const { error } = await supabase
                                .from('user_roles')
                                .insert([{ user_id: userData.id, role: newRole as any }]);
                              
                              if (error) throw error;
                              
                              setUserData({ ...userData, current_role: newRole });
                              toast({
                                title: 'Role updated',
                                description: `${userData.email} is now "${newRole}"`,
                              });
                            } catch (err: any) {
                              toast({
                                title: 'Error updating role',
                                description: err.message,
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete User
                  </Button>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Deleting a user will remove their account and all associated data. 
                    This action cannot be undone.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account for <strong>{userData?.email}</strong> and 
              all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
