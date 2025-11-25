import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { enrichContact, EnrichedContact, EnrichmentResult } from '@/utils/dataEnrichment';
import { toast } from '@/components/ui/use-toast';

interface ContactEnricherProps {
  contact: Contact;
  onEnriched: (enrichedContact: EnrichedContact) => void;
  trigger?: React.ReactNode;
}

export const ContactEnricher = ({
  contact,
  onEnriched,
  trigger
}: ContactEnricherProps) => {
  const [open, setOpen] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEnrich = async () => {
    setLoading(true);
    try {
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = enrichContact(contact);
      setEnrichmentResult(result);

      if (result.changes_made.length > 0) {
        toast({
          title: "Contact Enriched!",
          description: `${result.changes_made.length} improvements made to contact data.`,
        });
      } else {
        toast({
          title: "Contact Already Optimized",
          description: "This contact's data is already well-formatted and complete.",
        });
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      toast({
        title: "Enrichment Failed",
        description: "Failed to enrich contact data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = () => {
    if (enrichmentResult) {
      onEnriched(enrichmentResult.contact);
      setOpen(false);
      setEnrichmentResult(null);
      toast({
        title: "Changes Applied",
        description: "Contact data has been updated with enrichments.",
      });
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <CheckCircle className="h-4 w-4" />;
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'fair': return <AlertTriangle className="h-4 w-4" />;
      case 'poor': return <AlertTriangle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-8 w-8 p-0"
          title="Enrich Contact Data"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Data Enrichment - {contact.first_name} {contact.last_name}
            </DialogTitle>
            <DialogDescription>
              Automatically improve and standardize this contact's data using intelligent analysis.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Current Data Quality */}
            <div className="space-y-2">
              <h3 className="font-semibold">Current Data Quality</h3>
              <div className="flex items-center gap-3">
                <Badge
                  className={`${getQualityColor(enrichmentResult?.contact.data_quality || 'poor')} text-white`}
                >
                  {getQualityIcon(enrichmentResult?.contact.data_quality || 'poor')}
                  {enrichmentResult?.contact.data_quality || 'unknown'}
                </Badge>
                <div className="flex-1">
                  <Progress value={enrichmentResult?.contact.enrichment_score || 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {enrichmentResult?.contact.enrichment_score || 0}% complete
                  </p>
                </div>
              </div>
            </div>

            {/* Enrichment Button */}
            {!enrichmentResult && (
              <div className="flex justify-center py-8">
                <Button onClick={handleEnrich} disabled={loading} className="flex items-center gap-2">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Enrich Contact Data
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Enrichment Results */}
            {enrichmentResult && (
              <div className="space-y-6">
                {/* Changes Made */}
                {enrichmentResult.changes_made.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-green-700 dark:text-green-400">Changes Made</h3>
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {enrichmentResult.changes_made.map((change, index) => (
                            <li key={index}>{change}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Suggestions */}
                {enrichmentResult.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Improvement Suggestions</h3>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {enrichmentResult.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Data Preview */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Data Preview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {enrichmentResult.contact.first_name} {enrichmentResult.contact.last_name}</p>
                      <p><strong>Phone:</strong> {enrichmentResult.contact.phone || '—'}</p>
                      <p><strong>Email:</strong> {enrichmentResult.contact.email || '—'}</p>
                    </div>
                    <div className="space-y-2">
                      <p><strong>Address:</strong> {enrichmentResult.contact.address_1 || '—'}</p>
                      <p><strong>City:</strong> {enrichmentResult.contact.city || '—'}</p>
                      <p><strong>State:</strong> {enrichmentResult.contact.state || '—'}</p>
                      <p><strong>ZIP:</strong> {enrichmentResult.contact.zip_code || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* No Changes Message */}
                {enrichmentResult.changes_made.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      This contact's data is already well-formatted and complete. No changes were needed.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {enrichmentResult && enrichmentResult.changes_made.length > 0 && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyChanges} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Apply Changes
              </Button>
            </div>
          )}

          {enrichmentResult && enrichmentResult.changes_made.length === 0 && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
