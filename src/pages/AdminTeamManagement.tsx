import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useAgents, Agent } from '@/hooks/useAgents';
import { Copy, Mail, Plus, Users, Clock, CheckCircle, XCircle, Trash2, Edit, Shield, ShieldCheck } from 'lucide-react';
import { format, isAfter } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  code: string;
  used: boolean;
  created_at: string;
  expires_at: string;
}

const AdminTeamManagement = () => {
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvitations, setFetchingInvitations] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Agent editing state
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'agent' | 'admin'>('agent');
  const [editTeamName, setEditTeamName] = useState('');
  const [editBrokerage, setEditBrokerage] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editOfficeAddress, setEditOfficeAddress] = useState('');
  const [editOfficeNumber, setEditOfficeNumber] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editStateLicenses, setEditStateLicenses] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { agents, fetchAgents, getAgentDisplayName } = useAgents();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchInvitations();
    fetchAgents();
  }, [user, navigate, fetchAgents]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations((data as any) || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch invitations',
        variant: 'destructive',
      });
    } finally {
      setFetchingInvitations(false);
    }
  };

  const generateInvite = async () => {
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // First, invalidate any existing unused invitations for this email
      const { error: updateError } = await supabase
        .from('invitations' as any)
        .update({ used: true })
        .eq('email', email)
        .eq('used', false);

      if (updateError) {
        console.warn('Could not invalidate old invitations:', updateError);
        // Continue anyway - this is not critical
      }

      // Now create the new invitation
      const { data, error } = await supabase
        .from('invitations' as any)
        .insert({ email })
        .select('*')
        .single();

      if (error) throw error;
      if (!data) throw new Error('No invitation data returned');

      const invitationData = data as any; // Type assertion for invitation data

      // Send invitation email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
          body: {
            email: invitationData.email,
            code: invitationData.code,
            expiresAt: invitationData.expires_at,
          },
        });

        if (emailError) {
          console.error('Failed to send invitation email:', emailError);
          toast({
            title: 'Invitation created',
            description: `Invitation code generated for ${email}, but email failed to send. Copy the code manually.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Invitation sent!',
            description: `Invitation email sent to ${email} with signup instructions.`,
          });
        }
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        toast({
          title: 'Invitation created',
          description: `Invitation code generated for ${email}, but email failed to send. Copy the code manually.`,
          variant: 'default',
        });
      }

      setEmail('');
      fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resendInvitationEmail = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email: invitation.email,
          code: invitation.code,
          expiresAt: invitation.expires_at,
        },
      });

      if (emailError) {
        console.error('Failed to resend invitation email:', emailError);
        toast({
          title: 'Error',
          description: 'Failed to resend invitation email',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email resent!',
          description: `Invitation email resent to ${invitation.email}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation email',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  };

  const deleteInvitation = async (invitationId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('invitations' as any)
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Invitation deleted',
        description: `Invitation for ${email} has been removed`,
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete invitation',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: 'Copied',
        description: 'Invitation code copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Agent management functions
  const handleEditAgent = async (agent: Agent) => {
    setEditingAgent(agent);
    setEditFirstName(agent.first_name || '');
    setEditLastName(agent.last_name || '');
    setEditEmail(agent.email || '');
    setEditRole(agent.role as 'agent' | 'admin');

    // Fetch additional profile data from auth.users.raw_user_meta_data
    try {
      const { data: userData, error } = await supabase.auth.admin.getUserById(agent.user_id);
      if (error) throw error;

      const metaData = userData.user?.raw_user_meta_data || {};
      setEditTeamName(metaData.team_name || '');
      setEditBrokerage(metaData.brokerage || '');
      setEditPhoneNumber(metaData.phone_number || '');
      setEditOfficeAddress(metaData.office_address || '');
      setEditOfficeNumber(metaData.office_number || '');
      setEditWebsite(metaData.website || '');
      setEditStateLicenses(Array.isArray(metaData.state_licenses) ? metaData.state_licenses : []);
    } catch (error) {
      console.error('Error fetching user metadata:', error);
      // Set defaults if we can't fetch metadata
      setEditTeamName('');
      setEditBrokerage('');
      setEditPhoneNumber('');
      setEditOfficeAddress('');
      setEditOfficeNumber('');
      setEditWebsite('');
      setEditStateLicenses([]);
    }

    setEditDialogOpen(true);
  };

  const handleSaveAgentChanges = async () => {
    if (!editingAgent) return;

    setEditLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: editFirstName.trim() || null,
          last_name: editLastName.trim() || null,
          email: editEmail.trim() || null,
        })
        .eq('user_id', editingAgent.user_id);

      if (profileError) throw profileError;

      // Update role if changed
      if (editRole !== editingAgent.role) {
        // First delete existing role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingAgent.user_id);

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: editingAgent.user_id,
            role: editRole,
          });

        if (roleError) throw roleError;
      }

      // Update user metadata (additional profile fields)
      const { error: metadataError } = await supabase.functions.invoke('admin-update-user-metadata', {
        body: {
          userId: editingAgent.user_id,
          metadata: {
            team_name: editTeamName.trim() || null,
            brokerage: editBrokerage.trim() || null,
            phone_number: editPhoneNumber.trim() || null,
            office_address: editOfficeAddress.trim() || null,
            office_number: editOfficeNumber.trim() || null,
            website: editWebsite.trim() || null,
            state_licenses: editStateLicenses,
          }
        }
      });

      if (metadataError) {
        console.error('Metadata update error:', metadataError);
        toast({
          title: 'Warning',
          description: 'Basic info updated, but additional profile details may not have been saved',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Agent information updated successfully',
        });
      }

      setEditDialogOpen(false);
      setEditingAgent(null);
      fetchAgents(); // Refresh the agents list

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update agent',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    try {
      // Prevent deleting yourself
      if (agent.user_id === user?.id) {
        toast({
          title: 'Error',
          description: 'You cannot delete your own account',
          variant: 'destructive',
        });
        return;
      }

      // Delete from user_roles first (due to foreign key constraint)
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', agent.user_id);

      if (roleError) {
        console.error('Error deleting user roles:', roleError);
        throw new Error('Failed to remove user roles');
      }

      // Delete from profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', agent.user_id);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        throw new Error('Failed to remove user profile');
      }

      // Delete from auth.users (this requires admin privileges)
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: agent.user_id }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(`Failed to delete user account: ${error.message}`);
      }

      // Check if the function returned an error in the response
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      // Check if the function indicates success
      if (!data?.success) {
        console.error('Function did not return success:', data);
        throw new Error('Failed to delete user account: Unknown error');
      }

      toast({
        title: 'Success',
        description: `${getAgentDisplayName(agent)} has been removed from the team`,
      });

      fetchAgents(); // Refresh the agents list

    } catch (error: any) {
      console.error('Delete agent error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove agent',
        variant: 'destructive',
      });
    }
  };

  const extendInvitationExpiry = async (invitationId: string) => {
    try {
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + 30);

      const { error } = await supabase
        .from('invitations' as any)
        .update({ expires_at: newExpiryDate.toISOString() })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Expiration extended',
        description: 'Invitation expiration extended by 30 days',
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to extend expiration',
        variant: 'destructive',
      });
    }
  };

  const getInvitationStatus = (invitation: Invitation) => {
    if (invitation.used) {
      return { status: 'used', color: 'bg-green-500', icon: CheckCircle };
    }
    if (isAfter(new Date(), new Date(invitation.expires_at))) {
      return { status: 'expired', color: 'bg-red-500', icon: XCircle };
    }
    return { status: 'pending', color: 'bg-yellow-500', icon: Clock };
  };

  const activeInvitations = invitations.filter(inv => !inv.used && isAfter(new Date(inv.expires_at), new Date()));
  const usedInvitations = invitations.filter(inv => inv.used);
  const expiredInvitations = invitations.filter(inv => !inv.used && !isAfter(new Date(inv.expires_at), new Date()));

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage team members and invitations for Real Estate on Purpose
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{agents.length} team members</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{invitations.length} total invitations</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members ({agents.length})
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invitations ({invitations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Manage all team members, their roles, and access levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agents.map((agent) => (
                      <div
                        key={agent.user_id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{getAgentDisplayName(agent)}</p>
                            <p className="text-sm text-muted-foreground">{agent.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge variant={agent.role === 'admin' ? 'default' : 'secondary'}>
                            {agent.role === 'admin' ? (
                              <>
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-3 w-3 mr-1" />
                                Agent
                              </>
                            )}
                          </Badge>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAgent(agent)}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove {getAgentDisplayName(agent)} from the team.
                                  They will lose access to all features and data. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAgent(agent)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove Member
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeInvitations.length}</p>
                    <p className="text-sm text-muted-foreground">Active Invitations</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{usedInvitations.length}</p>
                    <p className="text-sm text-muted-foreground">Used Invitations</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="p-3 rounded-full bg-red-100">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{expiredInvitations.length}</p>
                    <p className="text-sm text-muted-foreground">Expired Invitations</p>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Generate New Invitation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Generate New Invitation
            </CardTitle>
            <CardDescription>
              Create a new invitation code for a team member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                type="email"
              />
              <Button onClick={generateInvite} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Invite'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invitations List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              All Invitations
            </CardTitle>
            <CardDescription>
              Manage all invitation codes and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetchingInvitations ? (
              <div className="flex justify-center py-8">
                <div className="text-muted-foreground">Loading invitations...</div>
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invitations created yet
              </div>
            ) : (
              <div className="space-y-4">
                {invitations.map((invitation) => {
                  const { status, color, icon: StatusIcon } = getInvitationStatus(invitation);
                  
                  return (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${color.replace('bg-', 'bg-').replace('-500', '-100')}`}>
                          <StatusIcon className={`h-4 w-4 ${color.replace('bg-', 'text-').replace('-500', '-600')}`} />
                        </div>
                        <div>
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Created {format(new Date(invitation.created_at), 'MMM dd, yyyy')} • 
                            Expires {format(new Date(invitation.expires_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge variant={status === 'used' ? 'default' : status === 'expired' ? 'destructive' : 'secondary'}>
                          {status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(invitation.code)}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Code
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendInvitationEmail(invitation)}
                          disabled={resendingId === invitation.id || invitation.used}
                          className="gap-2"
                        >
                          <Mail className="h-4 w-4" />
                          {resendingId === invitation.id ? 'Sending...' : 'Resend Email'}
                        </Button>
                        {!invitation.used && isAfter(new Date(), new Date(invitation.expires_at)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => extendInvitationExpiry(invitation.id)}
                            className="gap-2"
                          >
                            <Clock className="h-4 w-4" />
                            Extend
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteInvitation(invitation.id, invitation.email)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Agent Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>
                Update information for {editingAgent ? getAgentDisplayName(editingAgent) : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Enter email address"
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={editRole} onValueChange={(value: 'agent' | 'admin') => setEditRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Professional Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Professional Information</h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Team Name</label>
                  <Input
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    placeholder="Enter team name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brokerage</label>
                  <Input
                    value={editBrokerage}
                    onChange={(e) => setEditBrokerage(e.target.value)}
                    placeholder="Enter brokerage name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input
                      value={editPhoneNumber}
                      onChange={(e) => setEditPhoneNumber(e.target.value)}
                      placeholder="(555) 123-4567"
                      type="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Office Number</label>
                    <Input
                      value={editOfficeNumber}
                      onChange={(e) => setEditOfficeNumber(e.target.value)}
                      placeholder="(555) 123-4567"
                      type="tel"
                    />
                  </div>
                </div>
              </div>

              {/* Location & Licensing */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Location & Licensing</h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Office Address</label>
                  <Input
                    value={editOfficeAddress}
                    onChange={(e) => setEditOfficeAddress(e.target.value)}
                    placeholder="Enter office address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State Licenses</label>
                  <Input
                    value={editStateLicenses?.join(', ') || ''}
                    onChange={(e) => {
                      const licenses = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
                      setEditStateLicenses(licenses);
                    }}
                    placeholder="CA, NV, AZ (comma-separated)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter state codes separated by commas
                  </p>
                  {editStateLicenses && editStateLicenses.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editStateLicenses.map((license, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                        >
                          {license}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAgentChanges} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminTeamManagement;