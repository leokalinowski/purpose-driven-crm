import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { AgentMarketingSettingsForm } from '@/components/admin/AgentMarketingSettingsForm';
import { SubscriptionSettings } from '@/components/settings/SubscriptionSettings';
import { Loader2, User, Palette, CreditCard } from 'lucide-react';
import { buildAuthRedirectPath } from '@/utils/authRedirect';

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [teamName, setTeamName] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officeNumber, setOfficeNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [stateLicensesInput, setStateLicensesInput] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(buildAuthRedirectPath(), { replace: true });
      return;
    }
    loadProfile();
  }, [user, authLoading]);

  const loadProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, team_name, brokerage, phone_number, office_address, office_number, website, state_licenses')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setEmail(data.email || '');
        setTeamName(data.team_name || '');
        setBrokerage(data.brokerage || '');
        setPhoneNumber(data.phone_number || '');
        setOfficeAddress(data.office_address || '');
        setOfficeNumber(data.office_number || '');
        setWebsite(data.website || '');
        const licenses = Array.isArray(data.state_licenses) ? data.state_licenses : [];
        setStateLicensesInput(licenses.join(', '));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const licenses = stateLicensesInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          team_name: teamName.trim() || null,
          brokerage: brokerage.trim() || null,
          phone_number: phoneNumber.trim() || null,
          office_address: officeAddress.trim() || null,
          office_number: officeNumber.trim() || null,
          website: website.trim() || null,
          state_licenses: licenses.length > 0 ? licenses : null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Profile saved', description: 'Your profile information has been updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile information and branding</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList>
             <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Branding & Content
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Your name, contact info, and business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input id="phoneNumber" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="officeNumber">Office Number</Label>
                    <Input id="officeNumber" value={officeNumber} onChange={e => setOfficeNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="officeAddress">Office Address</Label>
                  <Input id="officeAddress" value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team Name</Label>
                    <Input id="teamName" value={teamName} onChange={e => setTeamName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brokerage">Brokerage</Label>
                    <Input id="brokerage" value={brokerage} onChange={e => setBrokerage(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stateLicenses">State Licenses (comma-separated)</Label>
                  <Input id="stateLicenses" value={stateLicensesInput} onChange={e => setStateLicensesInput(e.target.value)} placeholder="TX, CA, FL" />
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="mt-4">
            {user && (
              <AgentMarketingSettingsForm
                userId={user.id}
                agentName={`${firstName} ${lastName}`.trim() || 'My'}
                isAdmin={isAdmin}
              />
            )}
          </TabsContent>

          <TabsContent value="subscription" className="mt-4">
            <SubscriptionSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
