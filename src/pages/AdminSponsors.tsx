import React, { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useSponsors, PAYMENT_STATUSES, type Sponsor } from '@/hooks/useSponsors';
import { SponsorForm } from '@/components/admin/SponsorForm';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Pencil, Trash2, Search, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSponsors() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { sponsorsQuery, createSponsor, updateSponsor, deleteSponsor, uploadLogo } = useSponsors();

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);

  const filtered = useMemo(() => {
    let list = sponsorsQuery.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.company_name.toLowerCase().includes(q) ||
        s.contacts.some((c) => c.contact_name.toLowerCase().includes(q) || c.contact_email?.toLowerCase().includes(q))
      );
    }
    if (paymentFilter !== 'all') list = list.filter((s) => s.payment_status === paymentFilter);
    return list;
  }, [sponsorsQuery.data, search, paymentFilter]);

  const handleExportCSV = () => {
    const rows = filtered.map((s) => {
      const primary = s.contacts.find((c) => c.is_primary) ?? s.contacts[0];
      return {
        Company: s.company_name,
        'Primary Contact': primary?.contact_name ?? '',
        Email: primary?.contact_email ?? '',
        Phone: primary?.contact_phone ?? '',
        Region: primary?.region ?? '',
        Website: s.website ?? '',
        'Payment Status': s.payment_status ?? '',
        'Total Contributed': s.total_contributed,
        Events: s.event_count,
        Notes: s.notes ?? '',
      };
    });
    const header = Object.keys(rows[0] ?? {}).join(',');
    const csv = [header, ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sponsors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (data: Record<string, any>) => {
    const { _logoFile, ...rest } = data;
    const onSuccess = async (sponsorData?: any) => {
      const sid = editing?.id ?? sponsorData?.id;
      if (_logoFile && sid) {
        try { await uploadLogo(sid, _logoFile); } catch { /* logo upload failed, sponsor still saved */ }
      }
      setDialogOpen(false);
      setEditing(null);
    };

    if (editing) {
      updateSponsor.mutate({ id: editing.id, ...rest }, { onSuccess });
    } else {
      createSponsor.mutate({ ...rest, created_by: user?.id ?? null } as any, { onSuccess: (d) => onSuccess(d) });
    }
  };

  if (roleLoading) return <Layout><div className="p-6"><Skeleton className="h-8 w-48" /></div></Layout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const paymentBadgeVariant = (status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'paid': return 'default';
      case 'partial': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getPrimaryContact = (s: Sponsor) => s.contacts.find((c) => c.is_primary) ?? s.contacts[0] ?? null;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Sponsor Database</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Sponsor
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search sponsors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Payment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sponsorsQuery.isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {sponsorsQuery.data?.length ? 'No sponsors match your filters.' : 'No sponsors yet. Click "Add Sponsor" to get started.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="hidden lg:table-cell">Total Contributed</TableHead>
                    <TableHead className="hidden md:table-cell">Events</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const primary = getPrimaryContact(s);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {s.logo_url && <img src={s.logo_url} alt="" className="h-6 w-6 rounded object-contain" />}
                            <span>{s.company_name}</span>
                            {s.website && (
                              <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {primary ? (
                            <div>
                              <div className="text-sm flex items-center gap-1">
                                {primary.contact_name}
                                {s.contacts.length > 1 && <Badge variant="outline" className="text-xs ml-1">+{s.contacts.length - 1}</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">{primary.contact_email}{primary.region ? ` · ${primary.region}` : ''}</div>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell><Badge variant={paymentBadgeVariant(s.payment_status)} className="capitalize">{s.payment_status ?? '—'}</Badge></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {s.total_contributed > 0 ? `$${s.total_contributed.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Badge variant="outline">{s.event_count}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {s.company_name}?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove this sponsor, all contacts, and event links.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteSponsor.mutate(s.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Sponsor' : 'Add Sponsor'}</DialogTitle>
            <DialogDescription>{editing ? 'Update sponsor details below.' : 'Fill in the sponsor details below.'}</DialogDescription>
          </DialogHeader>
          <SponsorForm
            sponsor={editing}
            onSubmit={handleSubmit}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            isLoading={createSponsor.isPending || updateSponsor.isPending}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
