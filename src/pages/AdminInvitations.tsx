import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Copy, Mail, Plus, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format, isAfter } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  code: string;
  used: boolean;
  created_at: string;
  expires_at: string;
}

const AdminInvitations = () => {
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvitations, setFetchingInvitations] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchInvitations();
  }, [user, navigate]);

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
      const { data, error } = await supabase
        .from('invitations' as any)
        .insert({ email })
        .select('*')
        .single();

      if (error) throw error;

      toast({
        title: 'Invitation created',
        description: `Invitation code generated for ${email}`,
      });

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
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Team Invitations</h1>
            <p className="text-muted-foreground mt-2">
              Manage team member access to Real Estate on Purpose
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{invitations.length} total invitations</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminInvitations;