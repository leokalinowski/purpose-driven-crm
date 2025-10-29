import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

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
    active_listings?: number;
    median_days_on_market?: number;
    pending_ratio?: number;
    price_reduced_share?: number;
    price_per_sqft?: number;
  } | null;
}

export function AdminNewsletterPreview() {
  const [zipCode, setZipCode] = useState('')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableZips, setAvailableZips] = useState<string[]>([])
  const [loadingZips, setLoadingZips] = useState(true)
  const { session } = useAuth()

  useEffect(() => {
    const fetchAvailableZips = async () => {
      setLoadingZips(true)
      try {
        const { data, error } = await supabase
          .from('newsletter_market_data')
          .select('zip_code')
          .order('zip_code')
          .limit(50)
        
        if (data && !error) {
          const uniqueZips = Array.from(new Set(data.map(d => d.zip_code)))
          setAvailableZips(uniqueZips)
        }
      } catch (err) {
        console.error('Error fetching available ZIP codes:', err)
      } finally {
        setLoadingZips(false)
      }
    }
    
    fetchAvailableZips()
  }, [])

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
      
      const { data, error: invokeError } = await supabase.functions.invoke('market-data-grok', {
        body: {
          zip_code: zipCode,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          address: getRealisticAddress(zipCode),
          agent_name: 'Admin Test Agent',
          agent_info: 'Test Agent Information - This is a preview'
        }
      })
      
      if (invokeError) {
        throw new Error(invokeError.message || 'Preview generation failed')
      }
      
      if (data.error) {
        throw new Error(data.details || data.error || 'Preview generation failed')
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
          {loadingZips ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading available ZIP codes...
            </div>
          ) : availableZips.length > 0 ? (
            <Alert>
              <AlertDescription>
                <strong>Available ZIP codes in database:</strong>
                <div className="mt-2 text-sm">
                  {availableZips.slice(0, 15).join(', ')}
                  {availableZips.length > 15 && ` ... and ${availableZips.length - 15} more`}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                No market data found in database. Please upload a CSV file first.
              </AlertDescription>
            </Alert>
          )}

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
              placeholder={availableZips.length > 0 ? `Try: ${availableZips[0]}` : "Enter 5-digit ZIP code"}
              maxLength={5}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter a 5-digit ZIP code from the available list above to test the newsletter generation.
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
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>Market Intelligence Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {previewData.real_data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                      <p className="text-base font-semibold">{previewData.real_data.area_name} ({previewData.zip_code})</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data Source</p>
                      <p className="text-sm">{previewData.real_data.source}</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Key Market Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">Median Home Value</p>
                        <p className="text-lg font-bold">${previewData.real_data.median_value?.toLocaleString()}</p>
                        <p className="text-xs text-green-600">{previewData.real_data.value_change}</p>
                      </div>
                      
                      {previewData.real_data.active_listings !== undefined && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground">Active Listings</p>
                          <p className="text-lg font-bold">{previewData.real_data.active_listings}</p>
                        </div>
                      )}
                      
                      {previewData.real_data.median_days_on_market !== undefined && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground">Days on Market</p>
                          <p className="text-lg font-bold">{previewData.real_data.median_days_on_market} days</p>
                        </div>
                      )}
                      
                      {previewData.real_data.pending_ratio !== undefined && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground">Pending Ratio</p>
                          <p className="text-lg font-bold">{(previewData.real_data.pending_ratio * 100).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Buyer demand</p>
                        </div>
                      )}
                      
                      {previewData.real_data.price_reduced_share !== undefined && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground">Price Reductions</p>
                          <p className="text-lg font-bold">{(previewData.real_data.price_reduced_share * 100).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Of listings</p>
                        </div>
                      )}
                      
                      {previewData.real_data.price_per_sqft !== undefined && (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground">Price per Sq Ft</p>
                          <p className="text-lg font-bold">${previewData.real_data.price_per_sqft}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground">Last Updated: {new Date(previewData.real_data.last_updated).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        
          <Card>
            <CardHeader>
              <CardTitle>Generated Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white">
                <div 
                  dangerouslySetInnerHTML={{ __html: previewData.html_email }} 
                  className="prose max-w-none"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
