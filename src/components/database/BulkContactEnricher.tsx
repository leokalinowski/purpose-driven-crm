import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { enrichContact, EnrichedContact } from '@/utils/dataEnrichment';
import { toast } from '@/components/ui/use-toast';

interface BulkContactEnricherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onBulkEnriched: (enrichedContacts: EnrichedContact[]) => void;
}

export const BulkContactEnricher = ({
  open,
  onOpenChange,
  contacts,
  onBulkEnriched,
}: BulkContactEnricherProps) => {
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    enriched: number;
    skipped: number;
    enrichedContacts: EnrichedContact[];
    enrichmentDetails: string[];
  } | null>(null);

  const handleBulkEnrich = async () => {
    if (contacts.length === 0) {
      toast({
        title: "No Contacts to Enrich",
        description: "All contacts already have complete information.",
      });
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResults(null);

    const enrichedContacts: EnrichedContact[] = [];
    let enriched = 0;
    let skipped = 0;
    const enrichmentDetails: string[] = [];

    // Process contacts in batches to avoid blocking the UI
    const batchSize = 10;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      for (const contact of batch) {
        try {
          const originalQuality = Math.round(((() => {
            let score = 0;
            const totalFields = 3;
            if (contact.first_name && contact.last_name) score += 1;
            if (contact.phone || contact.email) score += 1;
            if (contact.address_1 || contact.city || contact.state || contact.zip_code) score += 1;
            return (score / totalFields) * 100;
          })()));

          const result = enrichContact(contact);

          // Calculate new quality score
          const newQuality = Math.round(((() => {
            let score = 0;
            const totalFields = 3;
            if (result.contact.first_name && result.contact.last_name) score += 1;
            if (result.contact.phone || result.contact.email) score += 1;
            if (result.contact.address_1 || result.contact.city || result.contact.state || result.contact.zip_code) score += 1;
            return (score / totalFields) * 100;
          })()));

          // Count as enriched if there were changes made or quality improved
          if (result.changes_made.length > 0 || newQuality > originalQuality) {
            enrichedContacts.push(result.contact);
            enriched++;

            // Track what was enriched
            if (result.changes_made.length > 0) {
              enrichmentDetails.push(`${contact.first_name || 'Unknown'} ${contact.last_name || 'Contact'}: ${result.changes_made.join(', ')}`);
            }
          } else {
            skipped++;
          }
        } catch (error) {
          console.error('Error enriching contact:', contact.id, error);
          skipped++;
        }
      }

      // Update progress
      setProgress(Math.round(((i + batch.length) / contacts.length) * 100));

      // Small delay to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    setResults({
      total: contacts.length,
      enriched,
      skipped,
      enrichedContacts,
      enrichmentDetails
    });

    setProcessing(false);
    setProgress(100);

    toast({
      title: "Bulk Enrichment Complete",
      description: enriched > 0
        ? `Successfully enriched ${enriched} contacts with improved data quality. Check the results below for details.`
        : `All ${contacts.length} contacts are already complete or can't be improved automatically.`,
    });
  };

  const handleApplyChanges = () => {
    if (results?.enrichedContacts) {
      onBulkEnriched(results.enrichedContacts);
      onOpenChange(false);
      setResults(null);
      setProgress(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setResults(null);
    setProgress(0);
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Bulk Contact Enrichment
          </DialogTitle>
          <DialogDescription>
            Automatically improve data quality for all {contacts.length} contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!results && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                This will analyze and improve contact data including:
                • Phone number formatting
                • Email standardization
                • Name capitalization
                • Address formatting
                • State abbreviation cleanup
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleBulkEnrich}
                  disabled={processing}
                  className="flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Start Enrichment
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {processing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing contacts...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">Bulk enrichment completed!</div>
                    <div className="text-sm space-y-1">
                      <div>• Total contacts: {results.total}</div>
                      <div className="text-green-600">• Enriched: {results.enriched}</div>
                      <div className="text-gray-500">• Already optimal: {results.skipped}</div>
                    </div>
                    {results.enrichmentDetails && results.enrichmentDetails.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs font-medium mb-2">What was improved:</div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {results.enrichmentDetails.slice(0, 10).map((detail, index) => (
                            <div key={index} className="text-xs text-muted-foreground">
                              • {detail}
                            </div>
                          ))}
                          {results.enrichmentDetails.length > 10 && (
                            <div className="text-xs text-muted-foreground italic">
                              ... and {results.enrichmentDetails.length - 10} more improvements
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleApplyChanges} className="flex-1">
                  Apply Changes
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
