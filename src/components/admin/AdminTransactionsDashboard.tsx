import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminTransactions, AgentLeaderboardEntry } from '@/hooks/useAdminTransactions';
import { DollarSign, TrendingUp, Clock, Target, RefreshCw, AlertTriangle, Trophy, ChevronDown, Users, Search } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

const rankBadge = (index: number) => {
  if (index === 0) return <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">🥇</Badge>;
  if (index === 1) return <Badge variant="secondary">🥈</Badge>;
  if (index === 2) return <Badge variant="outline">🥉</Badge>;
  return <span className="text-muted-foreground text-sm ml-1">#{index + 1}</span>;
};

export function AdminTransactionsDashboard() {
  const {
    transactions,
    teamMetrics,
    leaderboard,
    syncStatus,
    profiles,
    loading,
    syncing,
    discovering,
    discoverData,
    syncAllAgents,
    discoverOTC,
    getAgentDisplayInfo,
  } = useAdminTransactions();

  const [stageFilter, setStageFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentLeaderboardEntry | null>(null);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const filteredTransactions = transactions.filter((t) => {
    if (stageFilter !== 'all' && t.transaction_stage !== stageFilter) return false;
    if (agentFilter !== 'all') {
      const info = getAgentDisplayInfo(t);
      const key = t.responsible_agent || `ext_${info.name}`;
      if (key !== agentFilter) return false;
    }
    return true;
  });

  const agentDrillDown = selectedAgent
    ? transactions.filter((t) => {
        const info = getAgentDisplayInfo(t);
        const key = t.responsible_agent || `ext_${info.name}`;
        return key === selectedAgent.agentId;
      })
    : [];

  const totalTx = transactions.length;
  const closedCount = teamMetrics.totalClosed;
  const ongoingCount = teamMetrics.totalOngoing;

  const kpiCards = [
    { label: 'YTD Sales Volume', value: fmt(teamMetrics.ytdSalesVolume), icon: DollarSign, sub: `${closedCount} closed` },
    { label: 'YTD GCI', value: fmt(teamMetrics.ytdGci), icon: TrendingUp, sub: `${totalTx} total` },
    { label: 'MTD GCI', value: fmt(teamMetrics.mtdGci), icon: DollarSign },
    { label: 'Active Pipeline', value: fmt(teamMetrics.activePipelineValue), icon: Target, sub: `${ongoingCount} active` },
    { label: 'Avg Deal Velocity', value: `${teamMetrics.avgDealVelocity.toFixed(0)}d`, icon: Clock },
    { label: 'Closing Rate', value: `${teamMetrics.teamClosingRate.toFixed(0)}%`, icon: Trophy },
  ];

  // Helper to render agent name — red if external/unmatched
  const AgentName = ({ transaction }: { transaction: any }) => {
    const info = getAgentDisplayInfo(transaction);
    if (info.isExternal) {
      return <span className="text-red-500 font-medium">{info.name}</span>;
    }
    return <span>{info.name}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Section A — Team KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              {(kpi as any).sub && <p className="text-xs text-muted-foreground mt-1">{(kpi as any).sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section B — Agent Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Agent Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No transaction data available yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">GCI</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Avg Deal</TableHead>
                  <TableHead className="text-right">Close %</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((agent, i) => (
                  <TableRow
                    key={agent.agentId}
                    className="cursor-pointer"
                    onClick={() => setSelectedAgent(selectedAgent?.agentId === agent.agentId ? null : agent)}
                  >
                    <TableCell>{rankBadge(i)}</TableCell>
                    <TableCell className={`font-medium ${agent.isExternal ? 'text-red-500' : ''}`}>
                      {agent.agentName}
                      {agent.isExternal && <span className="text-xs text-red-400 ml-1">(not in Hub)</span>}
                    </TableCell>
                    <TableCell className="text-right">{agent.closedDeals}</TableCell>
                    <TableCell className="text-right">{fmt(agent.totalGci)}</TableCell>
                    <TableCell className="text-right">{fmt(agent.salesVolume)}</TableCell>
                    <TableCell className="text-right">{fmt(agent.avgDealSize)}</TableCell>
                    <TableCell className="text-right">{agent.closingRate.toFixed(0)}%</TableCell>
                    <TableCell className="text-right">{agent.ongoingDeals}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Agent Drill-Down */}
      {selectedAgent && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className={selectedAgent.isExternal ? 'text-red-500' : ''}>
                {selectedAgent.agentName}
                {selectedAgent.isExternal && <span className="text-xs text-red-400 ml-1">(not in Hub)</span>}
              </span>
              — Transaction Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedAgent.closedDeals}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{fmt(selectedAgent.totalGci)}</p>
                <p className="text-xs text-muted-foreground">Total GCI</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{fmt(selectedAgent.salesVolume)}</p>
                <p className="text-xs text-muted-foreground">Volume</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedAgent.ongoingDeals}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Property</TableHead>
                   <TableHead>Client</TableHead>
                   <TableHead>Type</TableHead>
                   <TableHead>Stage</TableHead>
                   <TableHead className="text-right">Price</TableHead>
                   <TableHead className="text-right">GCI</TableHead>
                   <TableHead>Close Date</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {agentDrillDown.map((t) => (
                   <TableRow key={t.id}>
                     <TableCell className="font-medium max-w-[200px] truncate">{t.property_address || '—'}</TableCell>
                     <TableCell>{t.client_name || '—'}</TableCell>
                     <TableCell>
                       <Badge variant="outline" className="text-xs">
                         {t.transaction_type === 'buy' ? 'Buyer' : t.transaction_type === 'sell' ? 'Seller' : '—'}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <Badge variant={t.transaction_stage === 'closed' ? 'default' : 'secondary'}>
                         {t.transaction_stage}
                       </Badge>
                     </TableCell>
                     <TableCell className="text-right">{t.sale_price ? fmt(t.sale_price) : '—'}</TableCell>
                     <TableCell className="text-right">{t.gci ? fmt(t.gci) : '—'}</TableCell>
                     <TableCell>{t.closing_date ? format(new Date(t.closing_date), 'MMM d, yyyy') : '—'}</TableCell>
                   </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Section C — Full Transaction Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {leaderboard.map((a) => (
                    <SelectItem key={a.agentId} value={a.agentId}>{a.agentName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="under_contract">Under Contract</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                 <TableHead>Agent</TableHead>
                 <TableHead>Property</TableHead>
                 <TableHead>Client</TableHead>
                 <TableHead>Type</TableHead>
                 <TableHead>Stage</TableHead>
                 <TableHead className="text-right">Price</TableHead>
                 <TableHead className="text-right">GCI</TableHead>
                 <TableHead>Close Date</TableHead>
                 <TableHead>Last Synced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
               <TableRow>
                   <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                     No transactions found.
                   </TableCell>
                 </TableRow>
              ) : (
                 filteredTransactions.slice(0, 100).map((t) => (
                   <TableRow key={t.id}>
                     <TableCell><AgentName transaction={t} /></TableCell>
                     <TableCell className="max-w-[180px] truncate">{t.property_address || '—'}</TableCell>
                     <TableCell>{t.client_name || '—'}</TableCell>
                     <TableCell>
                       <Badge variant="outline" className="text-xs">
                         {t.transaction_type === 'buy' ? 'Buyer' : t.transaction_type === 'sell' ? 'Seller' : '—'}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <Badge variant={t.transaction_stage === 'closed' ? 'default' : 'secondary'}>
                         {t.transaction_stage}
                       </Badge>
                     </TableCell>
                     <TableCell className="text-right">{t.sale_price ? fmt(t.sale_price) : '—'}</TableCell>
                     <TableCell className="text-right">{t.gci ? fmt(t.gci) : '—'}</TableCell>
                     <TableCell>{t.closing_date ? format(new Date(t.closing_date), 'MMM d, yyyy') : '—'}</TableCell>
                     <TableCell className="text-xs text-muted-foreground">
                       {t.last_synced_at ? format(new Date(t.last_synced_at), 'MMM d, HH:mm') : '—'}
                     </TableCell>
                   </TableRow>
                 ))
              )}
            </TableBody>
          </Table>
          {filteredTransactions.length > 100 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Showing 100 of {filteredTransactions.length} transactions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section D — Sync Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync Controls
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={discoverOTC} disabled={discovering}>
                <Search className={`h-4 w-4 mr-2 ${discovering ? 'animate-pulse' : ''}`} />
                {discovering ? 'Discovering...' : 'Discover OTC Fields'}
              </Button>
              <Button onClick={syncAllAgents} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync All Agents'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Last synced:</span>
            <span className="font-medium">
              {syncStatus.lastSyncedAt
                ? format(new Date(syncStatus.lastSyncedAt), 'MMM d, yyyy HH:mm')
                : 'Never'}
            </span>
            {syncStatus.syncErrorCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {syncStatus.syncErrorCount} errors
              </Badge>
            )}
          </div>
          {syncStatus.syncErrors.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-destructive hover:underline">
                <ChevronDown className="h-4 w-4" />
                View sync errors
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {syncStatus.syncErrors.map((se) => (
                  <div key={se.agentId} className="text-sm border rounded p-2">
                    <span className="font-medium">{se.agentName}:</span>
                    <ul className="list-disc ml-4 text-muted-foreground">
                      {se.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          {discoverData && (
            <div className="mt-4 space-y-3">
              <div className="text-sm font-medium">Discovery Results: {discoverData.reopCount} REOP properties out of {discoverData.totalFetched} sampled</div>
              {discoverData.teamNameValues && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Team names found: </span>
                  {discoverData.teamNameValues.map((tn: string, i: number) => (
                    <Badge key={i} variant={tn.toLowerCase().includes('real estate on purpose') ? 'default' : 'outline'} className="mr-1">
                      {tn}
                    </Badge>
                  ))}
                </div>
              )}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ChevronDown className="h-4 w-4" />
                  Agent Match Results ({discoverData.matchResults?.length || 0})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OTC Agent Name</TableHead>
                        <TableHead>Team Name</TableHead>
                        <TableHead>Matched To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(discoverData.matchResults || []).map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{m.otcAgentName || m.raName || '—'}</TableCell>
                          <TableCell>{m.teamName || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={m.userId ? 'default' : 'destructive'}>
                              {m.matched}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ChevronDown className="h-4 w-4" />
                  REOP Property Samples ({discoverData.reopSamples?.length || 0})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="text-xs bg-muted p-3 rounded max-h-64 overflow-auto">
                    {JSON.stringify(discoverData.reopSamples, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ChevronDown className="h-4 w-4" />
                  Hub Profiles ({discoverData.hubProfiles?.length || 0})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {(discoverData.hubProfiles || []).map((name: string, i: number) => (
                      <Badge key={i} variant="outline">{name}</Badge>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <ChevronDown className="h-4 w-4" />
                  All OTC Field Keys ({discoverData.fieldKeys?.length || 0})
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="text-xs bg-muted p-3 rounded max-h-64 overflow-auto">
                    {JSON.stringify(discoverData.fieldKeys, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
