import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const surveySchema = z.object({
  agent_name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email required').max(255),
  pipeline_stages: z.array(z.string()).min(1, 'Select at least one stage'),
  separate_buyer_seller: z.string().min(1, 'Please select an option'),
  must_have_fields: z.array(z.string()).min(1, 'Select at least one field'),
  additional_fields: z.string().max(1000).optional(),
  follow_up_automation: z.string().min(1, 'Please select an option'),
  activity_types: z.array(z.string()).min(1, 'Select at least one activity'),
  integration_priorities: z.array(z.string()),
  biggest_pain_point: z.string().max(2000).optional(),
  desired_views: z.array(z.string()).min(1, 'Select at least one view'),
  mobile_importance: z.string().min(1, 'Please rate mobile importance'),
  additional_comments: z.string().max(2000).optional(),
});

type SurveyFormData = z.infer<typeof surveySchema>;

const STAGE_OPTIONS = [
  'New Lead', 'Contacted', 'Qualified', 'Appointment Set', 'Appointment Held',
  'Agreement Signed', 'Active Listing / Searching', 'Under Contract',
  'Pending / Inspection / Appraisal', 'Closed', 'Post-Close / Nurture', 'Lost / Dead',
];

const FIELD_OPTIONS = [
  'Deal Value / Price', 'Expected Close Date', 'Commission %', 'Lead Source',
  'Property Address', 'MLS Number', 'Buyer/Seller Type', 'Loan Type / Pre-Approval Status',
  'Inspection Date', 'Appraisal Date', 'Contract Date', 'Closing Date',
  'Co-Agent / Referral Partner', 'Attorney / Title Company',
];

const ACTIVITY_OPTIONS = [
  'Phone Calls', 'Text Messages', 'Emails Sent', 'Showings / Tours',
  'Open Houses', 'Offers Written', 'Contracts Submitted', 'Follow-Up Reminders',
  'Notes / Comments',
];

const INTEGRATION_OPTIONS = [
  'SphereSync (Contact Database)', 'Events Management', 'Coaching Scoreboard',
  'Transactions Tracker', 'E-Newsletter', 'Social Media Scheduler',
];

const VIEW_OPTIONS = ['Kanban Board (Drag & Drop)', 'List / Table View', 'Calendar View', 'Map View'];

const SECTIONS = [
  { title: 'Your Info', description: 'Let us know who you are' },
  { title: 'Pipeline Stages', description: 'How do you want to organize your deals?' },
  { title: 'Fields & Data', description: 'What information matters most at a glance?' },
  { title: 'Automation & Activities', description: 'How can we save you time?' },
  { title: 'Integrations', description: 'Which tools should connect to your pipeline?' },
  { title: 'Views & Usability', description: 'How do you want to see your pipeline?' },
];

const PipelineSurvey = () => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SurveyFormData>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      agent_name: '', email: '',
      pipeline_stages: [], separate_buyer_seller: '',
      must_have_fields: [], additional_fields: '',
      follow_up_automation: '', activity_types: [],
      integration_priorities: [], biggest_pain_point: '',
      desired_views: [], mobile_importance: '',
      additional_comments: '',
    },
  });

  const { register, setValue, watch, trigger, formState: { errors } } = form;

  const toggleArrayValue = (field: keyof SurveyFormData, value: string) => {
    const current = (watch(field) as string[]) || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setValue(field, next, { shouldValidate: true });
  };

  const fieldsPerStep: (keyof SurveyFormData)[][] = [
    ['agent_name', 'email'],
    ['pipeline_stages', 'separate_buyer_seller'],
    ['must_have_fields', 'additional_fields'],
    ['follow_up_automation', 'activity_types'],
    ['integration_priorities'],
    ['desired_views', 'mobile_importance', 'biggest_pain_point', 'additional_comments'],
  ];

  const handleNext = async () => {
    const valid = await trigger(fieldsPerStep[step]);
    if (valid) setStep((s) => Math.min(s + 1, SECTIONS.length - 1));
  };

  const handleSubmit = async () => {
    const valid = await trigger();
    if (!valid) return;

    setSubmitting(true);
    const data = form.getValues();

    const { error } = await supabase.from('pipeline_survey_responses').insert({
      agent_name: data.agent_name,
      email: data.email,
      pipeline_stages: data.pipeline_stages,
      separate_buyer_seller: data.separate_buyer_seller,
      must_have_fields: data.must_have_fields,
      additional_fields: data.additional_fields || null,
      follow_up_automation: data.follow_up_automation,
      activity_types: data.activity_types,
      integration_priorities: data.integration_priorities,
      biggest_pain_point: data.biggest_pain_point || null,
      desired_views: data.desired_views,
      mobile_importance: data.mobile_importance,
      additional_comments: data.additional_comments || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error('Failed to submit. Please try again.');
      console.error(error);
      return;
    }

    setSubmitted(true);
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  };

  const progress = ((step + 1) / SECTIONS.length) * 100;

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <div className="h-2 rounded-t-lg bg-primary" />
          <CardContent className="pt-10 pb-10 space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Thank You!</h2>
            <p className="text-muted-foreground">
              Your feedback has been recorded. We'll use it to build the best pipeline experience for you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header card */}
        <Card className="overflow-hidden">
          <div className="h-3 bg-primary" />
          <CardHeader>
            <CardTitle className="text-2xl">Smart Pipeline Questionnaire</CardTitle>
            <CardDescription>
              Help us design the perfect deal-tracking pipeline for your real estate business.
              Your answers directly shape what we build — this takes about 3 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Section {step + 1} of {SECTIONS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Section card */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <CardHeader>
            <CardTitle className="text-lg">{SECTIONS[step].title}</CardTitle>
            <CardDescription>{SECTIONS[step].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Your Info */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="agent_name">Full Name *</Label>
                  <Input id="agent_name" {...register('agent_name')} placeholder="e.g. Jane Smith" />
                  {errors.agent_name && <p className="text-sm text-destructive">{errors.agent_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" type="email" {...register('email')} placeholder="jane@example.com" />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
              </>
            )}

            {/* Step 1: Pipeline Stages */}
            {step === 1 && (
              <>
                <div className="space-y-3">
                  <Label>Which pipeline stages would be useful for you? *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STAGE_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={(watch('pipeline_stages') || []).includes(opt)}
                          onCheckedChange={() => toggleArrayValue('pipeline_stages', opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {errors.pipeline_stages && <p className="text-sm text-destructive">{errors.pipeline_stages.message}</p>}
                </div>
                <div className="space-y-3">
                  <Label>Should there be separate pipelines for Buyers vs Sellers? *</Label>
                  <RadioGroup
                    value={watch('separate_buyer_seller')}
                    onValueChange={(v) => setValue('separate_buyer_seller', v, { shouldValidate: true })}
                  >
                    {['Yes, completely separate', 'No, one pipeline with a Buyer/Seller tag', 'Maybe — I\'d like to see both options'].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <RadioGroupItem value={opt} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.separate_buyer_seller && <p className="text-sm text-destructive">{errors.separate_buyer_seller.message}</p>}
                </div>
              </>
            )}

            {/* Step 2: Fields & Data */}
            {step === 2 && (
              <>
                <div className="space-y-3">
                  <Label>Which fields are must-haves on each deal card? *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FIELD_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={(watch('must_have_fields') || []).includes(opt)}
                          onCheckedChange={() => toggleArrayValue('must_have_fields', opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {errors.must_have_fields && <p className="text-sm text-destructive">{errors.must_have_fields.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additional_fields">Any other fields you'd want?</Label>
                  <Textarea id="additional_fields" {...register('additional_fields')} placeholder="Tell us about any fields or data points we missed…" />
                </div>
              </>
            )}

            {/* Step 3: Automation & Activities */}
            {step === 3 && (
              <>
                <div className="space-y-3">
                  <Label>How interested are you in automated follow-up reminders? *</Label>
                  <RadioGroup
                    value={watch('follow_up_automation')}
                    onValueChange={(v) => setValue('follow_up_automation', v, { shouldValidate: true })}
                  >
                    {['Very interested — automate everything!', 'Somewhat interested — gentle nudges are fine', 'Not interested — I\'ll manage manually'].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <RadioGroupItem value={opt} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.follow_up_automation && <p className="text-sm text-destructive">{errors.follow_up_automation.message}</p>}
                </div>
                <div className="space-y-3">
                  <Label>Which activities should be trackable on a deal? *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ACTIVITY_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={(watch('activity_types') || []).includes(opt)}
                          onCheckedChange={() => toggleArrayValue('activity_types', opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {errors.activity_types && <p className="text-sm text-destructive">{errors.activity_types.message}</p>}
                </div>
              </>
            )}

            {/* Step 4: Integrations */}
            {step === 4 && (
              <div className="space-y-3">
                <Label>Which existing features should connect to your pipeline?</Label>
                <p className="text-sm text-muted-foreground">Select all that you'd find valuable.</p>
                <div className="grid grid-cols-1 gap-2">
                  {INTEGRATION_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={(watch('integration_priorities') || []).includes(opt)}
                        onCheckedChange={() => toggleArrayValue('integration_priorities', opt)}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Views & Usability */}
            {step === 5 && (
              <>
                <div className="space-y-3">
                  <Label>How do you prefer to view your pipeline? *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {VIEW_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={(watch('desired_views') || []).includes(opt)}
                          onCheckedChange={() => toggleArrayValue('desired_views', opt)}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {errors.desired_views && <p className="text-sm text-destructive">{errors.desired_views.message}</p>}
                </div>
                <div className="space-y-3">
                  <Label>How important is mobile access for your pipeline? *</Label>
                  <RadioGroup
                    value={watch('mobile_importance')}
                    onValueChange={(v) => setValue('mobile_importance', v, { shouldValidate: true })}
                  >
                    {['Critical — I\'m on my phone most of the day', 'Nice to have — I mostly use desktop', 'Not important — desktop only is fine'].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                        <RadioGroupItem value={opt} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.mobile_importance && <p className="text-sm text-destructive">{errors.mobile_importance.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biggest_pain_point">What's your biggest pain point with tracking deals today?</Label>
                  <Textarea id="biggest_pain_point" {...register('biggest_pain_point')} placeholder="Tell us what frustrates you most…" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additional_comments">Anything else you'd like us to know?</Label>
                  <Textarea id="additional_comments" {...register('additional_comments')} placeholder="Additional ideas, wishes, concerns…" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < SECTIONS.length - 1 ? (
            <Button onClick={handleNext}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Real Estate on Purpose — Smart Pipeline Survey
        </p>
      </div>
    </div>
  );
};

export default PipelineSurvey;
