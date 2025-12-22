import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface CSVFile {
  id: string;
  filename: string;
  file_size: number;
  upload_date: string;
  is_active: boolean;
}

interface Campaign {
  id: string;
  name: string;
  campaign_name: string;
  body: string;
  status: string;
  created_at: string;
  created_by: string;
  send_date: string;
  recipient_count: number;
  open_rate: number;
  click_through_rate: number;
  updated_at: string;
}

interface Agent {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export function NewsletterSendManager() {
  const [campaignName, setCampaignName] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const { session } = useAuth()

  useEffect(() => {
    fetchAgents()
    fetchCSVFiles()
    fetchCampaigns()
  }, [])

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .order('first_name', { ascending: true })

      if (error) throw error
      setAgents(data || [])
      
      // Auto-select first agent if available
      if (data && data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].user_id)
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const fetchCSVFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_csv_files')
        .select('*')
        .eq('is_active', true)
        .order('upload_date', { ascending: false })

      if (error) throw error
      setCsvFiles(data || [])
    } catch (error) {
      console.error('Error fetching CSV files:', error)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setCampaigns(data || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const sendNewsletter = async () => {
    if (!campaignName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a campaign name' })
      return
    }

    if (!selectedAgentId) {
      setMessage({ type: 'error', text: 'Please select an agent' })
      return
    }

    if (csvFiles.length === 0) {
      setMessage({ type: 'error', text: 'No active CSV files found. Please upload market data first.' })
      return
    }

    setSending(true)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage({ type: 'error', text: 'Authentication required' })
        return
      }

      const response = await fetch(`https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/newsletter-send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          campaign_name: campaignName.trim(),
          dry_run: false
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Newsletter sending failed')
      }

      setMessage({
        type: 'success',
        text: `Newsletter campaign completed! Sent ${result.emails_sent} emails across ${result.zip_codes_processed} ZIP codes. Run ID: ${result.run_id}`
      })

      setCampaignName('')
      await fetchCampaigns()

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send newsletter' })
    } finally {
      setSending(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
      'draft': 'secondary',
      'sending': 'default',
      'sent': 'default',
      'completed': 'default',
      'failed': 'destructive'
    }
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAgentDisplayName = (agent: Agent) => {
    const name = `${agent.first_name || ''} ${agent.last_name || ''}`.trim()
    return name || agent.email || 'Unknown Agent'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Newsletter Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="agent-select">Select Agent</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger id="agent-select">
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.user_id} value={agent.user_id}>
                    {getAgentDisplayName(agent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Newsletter will be sent to all contacts owned by this agent
            </p>
          </div>

          <div>
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., December 2024 Market Update"
            />
          </div>

          <div>
            <Label>Newsletter Campaign Setup</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              This will send personalized newsletters to all agent contacts using CSV market data and AI-generated content. One email per ZIP code will be generated and sent to all contacts in that area.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-3 space-y-2">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>How it works:</strong> The system analyzes CSV market data for each unique ZIP code in contacts, generates personalized content using AI, and sends customized emails.
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 list-disc ml-4 space-y-1">
                <li>Duplicate emails are automatically filtered (one email per address)</li>
                <li>Invalid emails and unsubscribed contacts are skipped</li>
                <li>Rate limiting prevents API throttling (200ms between emails)</li>
                <li>One-click unsubscribe link included in every email</li>
              </ul>
            </div>
          </div>
          
          <Button
            onClick={sendNewsletter}
            disabled={!campaignName.trim() || !selectedAgentId || sending || csvFiles.length === 0}
            className="w-full"
          >
            {sending ? 'Sending Campaign...' : 'Send Newsletter Campaign'}
          </Button>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground">No campaigns created yet.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{campaign.campaign_name}</span>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Created: {formatDate(campaign.created_at)}</p>
                      {campaign.send_date && (
                        <p>Send Date: {formatDate(campaign.send_date)}</p>
                      )}
                      <p>Recipients: {campaign.recipient_count || 0} contacts</p>
                      {campaign.status === 'sent' && (
                        <p>Open Rate: {campaign.open_rate?.toFixed(1) || 0}% • Click Rate: {campaign.click_through_rate?.toFixed(1) || 0}%</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
