import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Mail, MapPin, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface NewsletterPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'user' | 'admin';
}

interface PreviewData {
  content: string;
  subject: string;
  zipCode: string;
  contactCount: number;
  estimatedCost: number;
}

export const NewsletterPreview: React.FC<NewsletterPreviewProps> = ({
  open,
  onOpenChange,
  mode = 'user'
}) => {
  const { user } = useAuth();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zipCode, setZipCode] = useState('90210'); // Default ZIP for demo
  const [sampleContact, setSampleContact] = useState<any>(null);

  // Clear preview data when ZIP code changes
  const handleZipCodeChange = (value: string) => {
    setZipCode(value);
    setPreviewData(null); // Clear previous preview
    setError(null); // Clear any previous errors
    setSampleContact(null); // Clear previous contact data
  };

  // Extract ZIP validation logic
  const validateZipCode = (zip: string): string | null => {
    if (!zip.trim()) return 'Please enter a ZIP code';
    const zipPattern = /^\d{5}$/;
    if (!zipPattern.test(zip.trim())) return 'Please enter a valid 5-digit ZIP code';
    return null;
  };

  const generatePreview = async () => {
    if (!user) return;

    const zipError = validateZipCode(zipCode);
    if (zipError) {
      setError(zipError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get real contacts for this ZIP to use their actual information
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, address_1, address_2, city, state, zip_code')
        .eq('agent_id', user.id)
        .eq('zip_code', zipCode.trim());
        
      if (contactsError) throw contactsError;
      
      // Use the first real contact for preview, or fallback to generic if none
      const contact = contacts && contacts.length > 0 ? contacts[0] : null;
      setSampleContact(contact);
      
      // Get agent profile information
      const { data: agentProfile, error: agentError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (agentError) throw agentError;
      
      // Generate a more realistic address based on ZIP code
      const getRealisticAddress = (zip: string) => {
        const addressMap: Record<string, string> = {
          '90210': '123 Rodeo Drive, Beverly Hills, CA',
          '10001': '123 Broadway, New York, NY',
          '33101': '123 Biscayne Blvd, Miami, FL',
          '60601': '123 Michigan Ave, Chicago, IL',
          '20001': '123 Constitution Ave NW, Washington, DC',
          '94102': '123 Market St, San Francisco, CA',
          '02108': '123 Beacon St, Boston, MA',
          '75201': '123 Main St, Dallas, TX'
        };
        return addressMap[zip] || `Property in ZIP ${zip}`;
      };

      // Use real contact data or fallback to realistic placeholder
      const contactData = contact ? {
        first_name: contact.first_name || 'John',
        last_name: contact.last_name || 'Doe',
        email: contact.email || 'preview@example.com',
        address: [
          contact.address_1,
          contact.address_2,
          contact.city,
          contact.state
        ].filter(Boolean).join(', ') || getRealisticAddress(zipCode.trim())
      } : {
        first_name: 'John',
        last_name: 'Doe',
        email: 'preview@example.com',
        address: getRealisticAddress(zipCode.trim())
      };

      // Generate preview content using market-data-grok with real contact data
      const { data: previewResult, error: previewError } = await supabase.functions.invoke('market-data-grok', {
        body: {
          zip_code: zipCode.trim(),
          first_name: contactData.first_name,
          last_name: contactData.last_name, 
          email: contactData.email,
          address: contactData.address,
          agent_name: `${agentProfile.first_name || ''} ${agentProfile.last_name || ''}`.trim(),
          agent_info: `${agentProfile.first_name || ''} ${agentProfile.last_name || ''}, Real Estate Agent, Email: ${agentProfile.email || ''}`
        }
      });
      
      if (previewError) {
        console.error('Preview generation error:', previewError);
        throw new Error(`Preview generation failed: ${previewError.message || 'Unknown error'}`);
      }

      if (previewResult && previewResult.success) {
        console.log('Preview result received:', { hasHtmlEmail: !!previewResult.html_email, zipCode: previewResult.zip_code });

        // Generate the footer with agent information
        const agentName = `${agentProfile.first_name || ''} ${agentProfile.last_name || ''}`.trim() || 'Your Real Estate Agent';
        const agentEmail = agentProfile.email || '';
        const teamName = agentProfile.team_name || '';
        const brokerage = agentProfile.brokerage || '';
        const officeAddress = agentProfile.office_address || '';
        const stateLicenses = agentProfile.state_licenses?.length ? agentProfile.state_licenses.join(' and ') : '';
        const phoneNumber = agentProfile.phone_number || '';
        const officeNumber = agentProfile.office_number || '';
        const website = agentProfile.website || '';

        const licenseText = stateLicenses ? `Licensed in ${stateLicenses}` : '';
        const companyLine = [teamName, brokerage].filter(Boolean).join(' | ');

        const footer = `
          <div style="padding: 30px 0; margin-top: 30px; border-top: 1px solid #e5e5e5; font-family: Arial, sans-serif; text-align: left;">
            <p style="color: #333; margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">
              ${agentName}${agentName ? ' - REALTOR®' : 'REALTOR®'}
            </p>
            ${companyLine ? `<p style="color: #666; margin: 0 0 3px 0; font-size: 14px;">${companyLine}</p>` : ''}
            ${officeAddress ? `<p style="color: #666; margin: 0 0 3px 0; font-size: 14px;">${officeAddress}</p>` : ''}
            ${licenseText ? `<p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">${licenseText}</p>` : ''}

            ${phoneNumber ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">📱 Cell/Text: <a href="tel:${phoneNumber.replace(/\D/g, '')}" style="color: #333; text-decoration: none;">${phoneNumber}</a></p>` : ''}
            ${officeNumber ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">☎️ Office: <a href="tel:${officeNumber.replace(/\D/g, '')}" style="color: #333; text-decoration: none;">${officeNumber}</a></p>` : ''}
            ${agentEmail ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">📧 <a href="mailto:${agentEmail}" style="color: #333; text-decoration: none;">${agentEmail}</a></p>` : ''}
            ${website ? `<p style="color: #333; margin: 3px 0; font-size: 14px;">🌐 <a href="${website.startsWith('http') ? website : 'https://' + website}" style="color: #333; text-decoration: none;">${website}</a></p>` : ''}

            <div style="font-size: 12px; color: #999; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
              <p style="margin: 3px 0;">
                This email was sent because you are a valued contact in our database.
              </p>
              <p style="margin: 3px 0;">
                If you no longer wish to receive these market updates, you can
                <a href="mailto:${agentEmail}?subject=Unsubscribe%20Request" style="color: #999;">unsubscribe here</a>.
              </p>
              <p style="margin: 3px 0;">
                © ${new Date().getFullYear()} ${agentName}. All rights reserved.
              </p>
            </div>
          </div>
        `;

        setPreviewData({
          content: previewResult.html_email + footer,
          subject: `Market Update for ${zipCode.trim()}`,
          zipCode: zipCode.trim(),
          contactCount: contacts?.length || 0,
          estimatedCost: (contacts?.length || 0) * 0.02 // Rough estimate
        });
      } else {
        console.error('Preview result structure:', previewResult);
        throw new Error(`Failed to generate preview content: ${previewResult?.error || 'Invalid response format'}`);
      }
    } catch (err: any) {
      console.error('Preview generation error:', err);
      setError(err.message || 'Failed to generate preview. This may be due to API limitations or network issues.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {mode === 'admin' ? 'Test Newsletter Preview' : 'Newsletter Preview'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'admin'
              ? 'Generate and preview newsletter content with real market data for testing'
              : 'Preview your newsletter content before sending to your contacts'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {mode === 'admin' ? 'Test Preview Settings' : 'Preview Settings'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="zip-code">ZIP Code</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="zip-code"
                      type="text"
                      placeholder="90210"
                      value={zipCode}
                      onChange={(e) => handleZipCodeChange(e.target.value)}
                      maxLength={5}
                      className="w-24"
                      disabled={loading}
                    />
                    <Button 
                      onClick={generatePreview} 
                      disabled={loading}
                      size="sm"
                    >
                      {loading ? 'Generating...' : 'Generate Preview'}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {mode === 'admin'
                    ? 'Enter a 5-digit ZIP code to generate a test newsletter with real CSV market data'
                    : 'Enter a 5-digit ZIP code to preview market data for that area'
                  }
                </div>
                {sampleContact && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <strong>Preview Contact:</strong> {sampleContact.first_name} {sampleContact.last_name} - {sampleContact.address_1}, {sampleContact.city}
                  </div>
                )}
              </div>
              
              {error && (
                <div className="space-y-3">
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                    {error}
                  </div>
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <strong>Requirements:</strong> Preview generation requires real CSV market data to be uploaded first. {mode === 'admin' ? 'Upload CSV data in the "CSV Upload" tab first.' : 'Contact your admin to upload market data.'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Stats */}
          {previewData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <Users className="h-6 w-6 mx-auto text-muted-foreground" />
                    <div className="text-2xl font-bold">{previewData.contactCount}</div>
                    <div className="text-sm text-muted-foreground">Recipients</div>
                  </div>
                  <div className="space-y-1">
                    <Mail className="h-6 w-6 mx-auto text-muted-foreground" />
                    <div className="text-2xl font-bold">${previewData.estimatedCost.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Est. Cost</div>
                  </div>
                  <div className="space-y-1">
                    <MapPin className="h-6 w-6 mx-auto text-muted-foreground" />
                    <div className="text-2xl font-bold">{previewData.zipCode}</div>
                    <div className="text-sm text-muted-foreground">ZIP Code</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Content */}
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ) : previewData ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {mode === 'admin' ? 'Test Email Preview' : 'Email Preview'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="text-sm text-muted-foreground mb-2">
                    Subject: {previewData.subject}
                  </div>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewData.content }}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Click "Generate Preview" to see your newsletter content
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
