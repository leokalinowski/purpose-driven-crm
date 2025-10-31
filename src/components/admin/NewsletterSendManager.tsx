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

export function NewsletterSendManager() {
  const [campaignName, setCampaignName] = useState('')
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const { session } = useAuth()

  useEffect(() => {
    fetchCSVFiles()
    fetchCampaigns()
  }, [])

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
          campaign_name: campaignName.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Newsletter sending failed')
      }

      setMessage({
        type: 'success',
        text: `Newsletter campaign started successfully! Run ID: ${result.run_id}`
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Newsletter Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., September 2024 Market Update"
            />
          </div>

          <div>
            <Label>Newsletter Campaign Setup</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              This will send personalized newsletters to all agent contacts using CSV market data and AI-generated content. One email per ZIP code will be generated and sent to all contacts in that area.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> The system analyzes CSV market data for each unique ZIP code in your contacts, generates personalized content using AI, and sends customized emails to all contacts in that ZIP code.
              </p>
            </div>
          </div>
          
          <Button
            onClick={sendNewsletter}
            disabled={!campaignName.trim() || sending || csvFiles.length === 0}
            className="w-full"
          >
            {sending ? 'Starting Campaign...' : 'Send Newsletter Campaign'}
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
                      <p>Recipients: {campaign.recipient_count} contacts</p>
                      <p>Open Rate: {campaign.open_rate}% • Click Rate: {campaign.click_through_rate}%</p>
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
