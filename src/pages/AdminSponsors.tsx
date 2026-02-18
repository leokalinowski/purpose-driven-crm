import React, { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useSponsors, TIERS, PAYMENT_STATUSES, type Sponsor } from '@/hooks/useSponsors';
import { SponsorForm } from '@/components/admin/SponsorForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { sponsorsQuery, createSponsor, updateSponsor, deleteSponsor } = useSponsors();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);

  const filtered = useMemo(() => {
    let list = sponsorsQuery.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.company_name.toLowerCase().includes(q) ||
        s.contact_name?.toLowerCase().includes(q) ||
        s.contact_email?.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== 'all') list = list.filter((s) => s.sponsorship_tier === tierFilter);
    if (paymentFilter !== 'all') list = list.filter((s) => s.payment_status === paymentFilter);
    return list;
  }, [sponsorsQuery.data, search, tierFilter, paymentFilter]);

  const handleExportCSV = () => {
    const rows = filtered.map((s) => ({
      Company: s.company_name,
      Contact: s.contact_name ?? '',
      Email: s.contact_email ?? '',
      Phone: s.contact_phone ?? '',
      Website: s.website ?? '',
      Tier: s.sponsorship_tier ?? '',
      Amount: s.sponsorship_amount ?? '',
      'Payment Status': s.payment_status ?? '',
      'Contract Status': s.contract_status ?? '',
      'Renewal Date': s.renewal_date ?? '',
      Events: s.event_count ?? 0,
      Notes: s.notes ?? '',
    }));
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

  const handleSubmit = (data: Record<string, any>) => {
    if (editing) {
      updateSponsor.mutate({ id: editing.id, ...data }, { onSuccess: () => { setDialogOpen(false); setEditing(null); } });
    } else {
      createSponsor.mutate({ ...data, created_by: user?.id ?? null } as any, { onSuccess: () => setDialogOpen(false) });
    }
  };

  if (roleLoading) return <Layout><div className="p-6"><Skeleton className="h-8 w-48" /></div></Layout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tierBadgeVariant = (tier: string | null) => {
    switch (tier) {
      case 'Gold': return 'default';
      case 'Silver': return 'secondary';
      case 'Bronze': return 'outline';
      default: return 'outline';
    }
  };

  const paymentBadgeVariant = (status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'paid': return 'default';
      case 'partial': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

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
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
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
                    <TableHead>Tier</TableHead>
                    <TableHead className="hidden lg:table-cell">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="hidden lg:table-cell">Contract</TableHead>
                    <TableHead className="hidden md:table-cell">Events</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
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
                        <div className="text-sm">{s.contact_name}</div>
                        <div className="text-xs text-muted-foreground">{s.contact_email}</div>
                      </TableCell>
                      <TableCell><Badge variant={tierBadgeVariant(s.sponsorship_tier)}>{s.sponsorship_tier ?? '—'}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell">{s.sponsorship_amount != null ? `$${Number(s.sponsorship_amount).toLocaleString()}` : '—'}</TableCell>
                      <TableCell><Badge variant={paymentBadgeVariant(s.payment_status)} className="capitalize">{s.payment_status ?? '—'}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell capitalize">{s.contract_status ?? '—'}</TableCell>
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
                                <AlertDialogDescription>This will permanently remove this sponsor and all event links.</AlertDialogDescription>
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
                  ))}
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
