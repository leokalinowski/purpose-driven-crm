import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useRSVP, RSVPFormData } from '@/hooks/useRSVP';
import { useRSVPQuestions, RSVPQuestion } from '@/hooks/useRSVPQuestions';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RSVPFormProps {
  eventId: string;
  maxCapacity?: number;
  currentCount?: number;
  onSuccess: () => void;
}

export const RSVPForm = ({ eventId, maxCapacity, currentCount, onSuccess }: RSVPFormProps) => {
  const { submitRSVP, loading, error } = useRSVP();
  const { getEventQuestions, submitAnswers } = useRSVPQuestions();
  const [formData, setFormData] = useState<RSVPFormData>({
    name: '',
    email: '',
    phone: '',
    guest_count: 1,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [customQuestions, setCustomQuestions] = useState<RSVPQuestion[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({});

  const isAtCapacity = maxCapacity !== undefined && maxCapacity !== null && currentCount !== undefined && currentCount >= maxCapacity;

  // Load custom questions
  useEffect(() => {
    const load = async () => {
      try {
        const questions = await getEventQuestions(eventId);
        setCustomQuestions(questions);
      } catch (err) {
        console.error('Failed to load custom questions:', err);
      }
    };
    load();
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name.trim()) {
      setFormError('Please enter your name');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }

    if (formData.guest_count < 1) {
      setFormError('Guest count must be at least 1');
      return;
    }

    // Validate required custom questions
    for (const q of customQuestions) {
      if (q.is_required) {
        if (q.question_type === 'checkbox') {
          const selected = checkboxAnswers[q.id] || [];
          if (selected.length === 0) {
            setFormError(`Please answer: ${q.question_text}`);
            return;
          }
        } else {
          const answer = customAnswers[q.id];
          if (!answer || !answer.trim()) {
            setFormError(`Please answer: ${q.question_text}`);
            return;
          }
        }
      }
    }

    try {
      const rsvp = await submitRSVP(eventId, formData);

      // Submit custom answers if any
      const answersToSubmit: { question_id: string; answer_text: string }[] = [];
      for (const q of customQuestions) {
        if (q.question_type === 'checkbox') {
          const selected = checkboxAnswers[q.id] || [];
          if (selected.length > 0) {
            answersToSubmit.push({ question_id: q.id, answer_text: selected.join(', ') });
          }
        } else {
          const answer = customAnswers[q.id];
          if (answer && answer.trim()) {
            answersToSubmit.push({ question_id: q.id, answer_text: answer.trim() });
          }
        }
      }

      if (answersToSubmit.length > 0) {
        try {
          await submitAnswers(rsvp.id, answersToSubmit);
        } catch (err) {
          console.error('Failed to submit custom answers:', err);
          // Don't fail the RSVP if answers fail
        }
      }

      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit RSVP. Please try again.');
    }
  };

  const renderCustomQuestion = (q: RSVPQuestion) => {
    switch (q.question_type) {
      case 'text':
        return (
          <Input
            value={customAnswers[q.id] || ''}
            onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
            disabled={loading}
          />
        );
      case 'textarea':
        return (
          <Textarea
            value={customAnswers[q.id] || ''}
            onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
            rows={3}
            disabled={loading}
          />
        );
      case 'select':
        return (
          <Select
            value={customAnswers[q.id] || ''}
            onValueChange={(val) => setCustomAnswers({ ...customAnswers, [q.id]: val })}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {(q.options as string[] || []).map((opt, i) => (
                <SelectItem key={i} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        const selected = checkboxAnswers[q.id] || [];
        return (
          <div className="space-y-2">
            {(q.options as string[] || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Checkbox
                  id={`${q.id}-${i}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    const updated = checked
                      ? [...selected, opt]
                      : selected.filter(s => s !== opt);
                    setCheckboxAnswers({ ...checkboxAnswers, [q.id]: updated });
                  }}
                  disabled={loading}
                />
                <Label htmlFor={`${q.id}-${i}`} className="text-sm font-normal">{opt}</Label>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || formError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || formError}</AlertDescription>
        </Alert>
      )}

      {isAtCapacity && (
        <Alert>
          <AlertDescription>
            This event is at capacity. You will be added to the waitlist.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="rsvp-name">Full Name *</Label>
        <Input
          id="rsvp-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Doe"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-email">Email Address *</Label>
        <Input
          id="rsvp-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-phone">Phone Number</Label>
        <Input
          id="rsvp-phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(555) 123-4567"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-guests">Number of Guests (including yourself)</Label>
        <Input
          id="rsvp-guests"
          type="number"
          min="1"
          max="10"
          value={formData.guest_count}
          onChange={(e) => setFormData({ ...formData, guest_count: parseInt(e.target.value) || 1 })}
          disabled={loading}
        />
        <p className="text-sm text-muted-foreground">
          Total attendees: {formData.guest_count}
        </p>
      </div>

      {/* Custom Questions */}
      {customQuestions.map((q) => (
        <div key={q.id} className="space-y-2">
          <Label>
            {q.question_text}
            {q.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {renderCustomQuestion(q)}
        </div>
      ))}

      <Button
        type="submit"
        className="w-full"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : isAtCapacity ? (
          'Join Waitlist'
        ) : (
          'RSVP Now'
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By RSVPing, you agree to receive event updates via email.
      </p>
    </form>
  );
};
