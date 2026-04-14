import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Users } from 'lucide-react';
import { format } from 'date-fns';
import Papa from 'papaparse';

const ArrayField = ({ label, values }: { label: string; values: string[] | null }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
    {values && values.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground italic">Not answered</p>
    )}
  </div>
);

const TextField = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
    <p className="text-sm">{value || <span className="text-muted-foreground italic">Not answered</span>}</p>
  </div>
);

const AdminSurveyResults = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['survey-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_survey_responses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const aggregateArray = (field: string) => {
    const counts: Record<string, number> = {};
    responses.forEach((r: any) => {
      const arr = r[field] as string[] | null;
      arr?.forEach((v: string) => { counts[v] = (counts[v] || 0) + 1; });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const stagesData = useMemo(() => aggregateArray('pipeline_stages'), [responses]);
  const fieldsData = useMemo(() => aggregateArray('must_have_fields'), [responses]);
  const integrationsData = useMemo(() => aggregateArray('integration_priorities'), [responses]);
  const viewsData = useMemo(() => aggregateArray('desired_views'), [responses]);

  const handleExport = () => {
    const csv = Papa.unparse(responses.map((r: any) => ({
      Name: r.agent_name,
      Email: r.email,
      'Submitted At': r.created_at,
      'Pipeline Stages': r.pipeline_stages?.join(', '),
      'Separate Buyer/Seller': r.separate_buyer_seller,
      'Must-Have Fields': r.must_have_fields?.join(', '),
      'Additional Fields': r.additional_fields,
      'Follow-Up Automation': r.follow_up_automation,
      'Activity Types': r.activity_types?.join(', '),
      'Integration Priorities': r.integration_priorities?.join(', '),
      'Biggest Pain Point': r.biggest_pain_point,
      'Desired Views': r.desired_views?.join(', '),
      'Mobile Importance': r.mobile_importance,
      'Additional Comments': r.additional_comments,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-survey-results-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ChartCard = ({ title, data }: { title: string; data: { name: string; count: number }[] }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(180, 100%, 25%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline Survey Results</h1>
            <p className="text-muted-foreground">{responses.length} response{responses.length !== 1 ? 's' : ''} collected</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={responses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : responses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No responses yet. Share the survey link to start collecting feedback.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Most Requested Pipeline Stages" data={stagesData} />
              <ChartCard title="Must-Have Fields" data={fieldsData} />
              <ChartCard title="Integration Priorities" data={integrationsData} />
              <ChartCard title="Preferred Views" data={viewsData} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Responses</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="space-y-2">
                  {responses.map((r: any) => (
                    <AccordionItem key={r.id} value={r.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <span className="font-medium">{r.agent_name}</span>
                          <span className="text-muted-foreground text-sm">{r.email}</span>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(r.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <ArrayField label="Pipeline Stages" values={r.pipeline_stages} />
                          <TextField label="Separate Buyer/Seller Pipelines" value={r.separate_buyer_seller} />
                          <ArrayField label="Must-Have Fields" values={r.must_have_fields} />
                          <TextField label="Additional Fields Requested" value={r.additional_fields} />
                          <TextField label="Follow-Up Automation Interest" value={r.follow_up_automation} />
                          <ArrayField label="Activity Types" values={r.activity_types} />
                          <ArrayField label="Integration Priorities" values={r.integration_priorities} />
                          <TextField label="Biggest Pain Point" value={r.biggest_pain_point} />
                          <ArrayField label="Desired Views" values={r.desired_views} />
                          <TextField label="Mobile Importance" value={r.mobile_importance} />
                          <TextField label="Additional Comments" value={r.additional_comments} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminSurveyResults;
