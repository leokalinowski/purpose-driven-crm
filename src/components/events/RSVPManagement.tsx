import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRSVP, RSVP } from '@/hooks/useRSVP';
import { CheckCircle2, Clock, XCircle, Search, Download, ExternalLink, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { RSVPStats } from './rsvp/RSVPStats';

interface RSVPManagementProps {
  eventId: string;
  publicSlug?: string;
}

export const RSVPManagement = ({ eventId, publicSlug }: RSVPManagementProps) => {
  const { getEventRSVPs, getRSVPStats, checkInRSVP } = useRSVP();
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');

  useEffect(() => {
    loadRSVPs();
    loadStats();
  }, [eventId]);

  const loadRSVPs = async () => {
    try {
      const data = await getEventRSVPs(eventId);
      setRsvps(data);
    } catch (error: any) {
      toast.error('Failed to load RSVPs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getRSVPStats(eventId);
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleCheckIn = async (rsvpId: string) => {
    try {
      await checkInRSVP(rsvpId);
      toast.success('RSVP checked in successfully');
      loadRSVPs();
      loadStats();
    } catch (error: any) {
      toast.error('Failed to check in: ' + error.message);
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Guest Count', 'Status', 'RSVP Date', 'Check-In Status'];
    const rows = filteredRSVPs.map(rsvp => [
      rsvp.name,
      rsvp.email,
      rsvp.phone || '',
      rsvp.guest_count.toString(),
      rsvp.status,
      format(new Date(rsvp.rsvp_date), 'MM/dd/yyyy HH:mm'),
      rsvp.check_in_status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvps-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPublicPageUrl = () => {
    if (!publicSlug) return null;
    return `${window.location.origin}/event/${publicSlug}`;
  };

  const filteredRSVPs = rsvps.filter(rsvp => {
    const matchesSearch = 
      rsvp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rsvp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rsvp.phone && rsvp.phone.includes(searchQuery));

    if (selectedTab === 'all') return matchesSearch;
    if (selectedTab === 'confirmed') return matchesSearch && rsvp.status === 'confirmed';
    if (selectedTab === 'waitlist') return matchesSearch && rsvp.status === 'waitlist';
    if (selectedTab === 'checked-in') return matchesSearch && rsvp.check_in_status === 'checked_in';
    if (selectedTab === 'not-checked-in') return matchesSearch && rsvp.check_in_status === 'not_checked_in';

    return matchesSearch;
  });

  const getStatusBadge = (rsvp: RSVP) => {
    if (rsvp.status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (rsvp.status === 'waitlist') {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Waitlist</Badge>;
    }
    if (rsvp.check_in_status === 'checked_in') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Checked In</Badge>;
    }
    return <Badge variant="outline">Confirmed</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RSVP Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading RSVPs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>RSVP Management</CardTitle>
            <CardDescription>
              Manage RSVPs for this event
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {publicSlug && getPublicPageUrl() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getPublicPageUrl(), '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Public Page
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && (
          <RSVPStats
            total={stats.total}
            confirmed={stats.confirmed}
            waitlist={stats.waitlist}
            checkedIn={stats.checked_in}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({rsvps.length})</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed ({rsvps.filter(r => r.status === 'confirmed').length})</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist ({rsvps.filter(r => r.status === 'waitlist').length})</TabsTrigger>
            <TabsTrigger value="checked-in">Checked In ({rsvps.filter(r => r.check_in_status === 'checked_in').length})</TabsTrigger>
            <TabsTrigger value="not-checked-in">Not Checked In ({rsvps.filter(r => r.check_in_status === 'not_checked_in').length})</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-4">
            <div className="space-y-2">
              {filteredRSVPs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No RSVPs found
                </p>
              ) : (
                filteredRSVPs.map((rsvp) => (
                  <div
                    key={rsvp.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{rsvp.name}</h4>
                        {getStatusBadge(rsvp)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{rsvp.email}</p>
                        {rsvp.phone && <p>{rsvp.phone}</p>}
                        <p>
                          {rsvp.guest_count} {rsvp.guest_count === 1 ? 'guest' : 'guests'} • RSVP'd{' '}
                          {format(new Date(rsvp.rsvp_date), 'MMM d, yyyy')}
                        </p>
                        {rsvp.checked_in_at && (
                          <p className="text-green-600">
                            Checked in: {format(new Date(rsvp.checked_in_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rsvp.check_in_status === 'not_checked_in' && rsvp.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckIn(rsvp.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

