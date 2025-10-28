import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface PreviewData {
  success: boolean;
  zip_code: string;
  html_email: string;
  real_data: {
    median_value: number;
    value_change: string;
    area_name: string;
    source: string;
    last_updated: string;
  } | null;
}

export function AdminNewsletterPreview() {
  const [zipCode, setZipCode] = useState('')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()

  const generatePreview = async () => {
    if (!zipCode) {
      setError('Please enter a ZIP code')
      return
    }

    if (!/^\d{5}$/.test(zipCode)) {
      setError('Please enter a valid 5-digit ZIP code')
      return
    }
    
    setLoading(true)
    setError(null)
    setPreviewData(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        setError('Authentication required')
        return
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data-grok`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zip_code: zipCode,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          address: getRealisticAddress(zipCode),
          agent_name: 'Admin Test Agent',
          agent_info: 'Test Agent Information - This is a preview'
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Preview generation failed')
      }
      
      setPreviewData(data)
      
    } catch (error: any) {
      setError(error.message || 'Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  const getRealisticAddress = (zipCode: string): string => {
    const addresses: { [key: string]: string } = {
      '20001': '123 Constitution Ave NW, Washington, DC',
      '20002': '456 Anacostia Ave SE, Washington, DC',
      '20005': '789 Dupont Circle NW, Washington, DC',
      '90210': '123 Rodeo Drive, Beverly Hills, CA',
      '10001': '456 Broadway, New York, NY',
      '10002': '789 Canal St, New York, NY',
      '33101': '123 Biscayne Blvd, Miami, FL',
      '60601': '456 State St, Chicago, IL',
      '77001': '789 Main St, Houston, TX',
      '85001': '123 Central Ave, Phoenix, AZ'
    }
    
    return addresses[zipCode] || `123 Main St, ZIP ${zipCode}`
  }

  const clearPreview = () => {
    setPreviewData(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Newsletter Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-zip">ZIP Code</Label>
            <Input
              id="test-zip"
              value={zipCode}
              onChange={(e) => {
                setZipCode(e.target.value)
                if (previewData || error) {
                  clearPreview()
                }
              }}
              placeholder="Enter ZIP code to test (e.g., 20001)"
              maxLength={5}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter a 5-digit ZIP code to generate a preview newsletter with real market data.
            </p>
          </div>
          
          <Button 
            onClick={generatePreview} 
            disabled={!zipCode || loading}
            className="w-full"
          >
            {loading ? 'Generating Preview...' : 'Generate Preview'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {previewData?.real_data && (
            <Alert>
              <AlertDescription>
                <strong>Real Data Found:</strong> {previewData.real_data.area_name} - 
                Median Value: ${previewData.real_data.median_value?.toLocaleString()} 
                ({previewData.real_data.value_change}) - 
                Source: {previewData.real_data.source}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Result - ZIP {previewData.zip_code}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-white">
              <div 
                dangerouslySetInnerHTML={{ __html: previewData.html_email }} 
                className="prose max-w-none"
              />
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Preview Details:</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>ZIP Code:</strong> {previewData.zip_code}</p>
                <p><strong>Market Data:</strong> {previewData.real_data ? 'Real data found' : 'No real data available'}</p>
                {previewData.real_data && (
                  <>
                    <p><strong>Area:</strong> {previewData.real_data.area_name}</p>
                    <p><strong>Median Value:</strong> ${previewData.real_data.median_value?.toLocaleString()}</p>
                    <p><strong>Value Change:</strong> {previewData.real_data.value_change}</p>
                    <p><strong>Data Source:</strong> {previewData.real_data.source}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
