import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import { Contact } from '@/hooks/useContacts';
import { calculateDataQualityScore, generateEnrichmentSuggestions, EnrichedContact } from '@/utils/dataEnrichment';
import { BulkContactEnricher } from './BulkContactEnricher';

interface DataQualityDashboardProps {
  contacts: Contact[];
  onBulkEnriched?: (enrichedContacts: EnrichedContact[]) => void;
}

export const DataQualityDashboard: React.FC<DataQualityDashboardProps> = ({ contacts, onBulkEnriched }) => {
  const [showBulkEnricher, setShowBulkEnricher] = React.useState(false);
  
  // Ensure contacts is always an array
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  
  // Calculate quality scores and suggestions for all contacts
  const contactsWithQuality = safeContacts.map(contact => ({
    ...contact,
    quality_score: calculateDataQualityScore(contact),
    suggestions: generateEnrichmentSuggestions(contact)
  }));

  // Calculate stats manually
  const totalContacts = contactsWithQuality.length;
  const averageQualityScore = totalContacts > 0
    ? Math.round(contactsWithQuality.reduce((sum, c) => sum + c.quality_score, 0) / totalContacts)
    : 0;

  // Count quality distribution based on 4-field score
  const qualityCounts = contactsWithQuality.reduce((acc, contact) => {
    let quality = 'poor';
    if (contact.quality_score === 100) quality = 'excellent';
    else if (contact.quality_score >= 75) quality = 'good';
    else if (contact.quality_score >= 50) quality = 'fair';
    acc[quality] = (acc[quality] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get most common suggestions
  const suggestionCounts: Record<string, number> = {};
  contactsWithQuality.forEach(contact => {
    contact.suggestions.forEach(suggestion => {
      suggestionCounts[suggestion] = (suggestionCounts[suggestion] || 0) + 1;
    });
  });

  const mostCommonSuggestions = Object.entries(suggestionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([suggestion]) => suggestion);

  const stats = {
    total_contacts: totalContacts,
    average_quality_score: averageQualityScore,
    quality_distribution: {
      excellent: qualityCounts.excellent || 0,
      good: qualityCounts.good || 0,
      fair: qualityCounts.fair || 0,
      poor: qualityCounts.poor || 0,
    },
    most_common_suggestions: mostCommonSuggestions,
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-blue-600 dark:text-blue-400';
      case 'fair': return 'text-yellow-600 dark:text-yellow-400';
      case 'poor': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <CheckCircle className="h-4 w-4" />;
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'fair': return <AlertTriangle className="h-4 w-4" />;
      case 'poor': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Overall Quality Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.average_quality_score}%</div>
          <Progress value={stats.average_quality_score} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Average completeness
          </p>
        </CardContent>
      </Card>

      {/* Quality Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Quality Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="h-3 w-3" />
              Complete
            </span>
            <span>{formatPercentage(stats.quality_distribution.excellent, stats.total_contacts)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <CheckCircle className="h-3 w-3" />
              Good
            </span>
            <span>{formatPercentage(stats.quality_distribution.good, stats.total_contacts)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              Fair
            </span>
            <span>{formatPercentage(stats.quality_distribution.fair, stats.total_contacts)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-3 w-3" />
              Poor
            </span>
            <span>{formatPercentage(stats.quality_distribution.poor, stats.total_contacts)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Suggestions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Top Suggestions
          </CardTitle>
          <CardDescription className="text-xs">
            Focus on core contact information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.most_common_suggestions.filter(suggestion =>
              suggestion.includes('name') ||
              suggestion.includes('phone') ||
              suggestion.includes('email') ||
              suggestion.includes('address')
            ).slice(0, 3).map((suggestion, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                • {suggestion}
              </div>
            ))}
            {stats.most_common_suggestions.filter(suggestion =>
              suggestion.includes('name') ||
              suggestion.includes('phone') ||
              suggestion.includes('email') ||
              suggestion.includes('address')
            ).length === 0 && (
              <div className="text-xs text-green-600 dark:text-green-400">
                All contacts have complete core information!
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">
              Quality Score = (Name + Phone + Email + Address) / 4 × 100
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><strong>Complete:</strong> 100%</div>
              <div><strong>Good:</strong> 75-99%</div>
              <div><strong>Fair:</strong> 50-74%</div>
              <div><strong>Poor:</strong> 0-49%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Use the enrich button (✨) on individual contacts to improve data quality.
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium">Contacts Needing Attention:</div>
            {(() => {
              const poorContacts = contactsWithQuality
                .filter(c => c.quality_score < 75) // Updated threshold for 4-field scoring
                .slice(0, 5)
                .map(c => `${c.first_name} ${c.last_name}`)
                .join(', ');

              return poorContacts ? (
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  {poorContacts}
                </div>
              ) : (
                <div className="text-xs text-green-600 dark:text-green-400">
                  All contacts have complete core information!
                </div>
              );
            })()}
          </div>

          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowBulkEnricher(true)}
              disabled={contactsWithQuality.filter(c => c.quality_score < 75).length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Enrich Contacts Needing Attention ({contactsWithQuality.filter(c => c.quality_score < 75).length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Contact Enricher Dialog */}
      <BulkContactEnricher
        open={showBulkEnricher}
        onOpenChange={setShowBulkEnricher}
        contacts={contactsWithQuality
          .filter(c => c.quality_score < 75) // Only enrich contacts that need it
          .map(c => ({
            id: c.id,
            agent_id: c.agent_id,
            first_name: c.first_name,
            last_name: c.last_name,
            phone: c.phone,
            email: c.email,
            address_1: c.address_1,
            address_2: c.address_2,
            city: c.city,
            state: c.state,
            zip_code: c.zip_code,
            tags: c.tags,
            dnc: c.dnc,
            notes: c.notes,
            category: c.category,
            last_activity_date: c.last_activity_date,
            activity_count: c.activity_count,
            created_at: c.created_at,
            updated_at: c.updated_at,
            dnc_last_checked: c.dnc_last_checked
          })) // Convert back to Contact type
        }
        onBulkEnriched={(enrichedContacts) => {
          if (onBulkEnriched) {
            onBulkEnriched(enrichedContacts);
          }
          setShowBulkEnricher(false);
        }}
      />
    </div>
  );
};
