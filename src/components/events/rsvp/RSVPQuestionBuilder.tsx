import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useRSVPQuestions, RSVPQuestion } from '@/hooks/useRSVPQuestions';
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, X } from 'lucide-react';
import { toast } from 'sonner';

interface RSVPQuestionBuilderProps {
  eventId: string;
}

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkboxes' },
];

export const RSVPQuestionBuilder = ({ eventId }: RSVPQuestionBuilderProps) => {
  const { getEventQuestions, addQuestion, updateQuestion, deleteQuestion } = useRSVPQuestions();
  const [questions, setQuestions] = useState<RSVPQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local draft state for new/editing questions
  const [draftText, setDraftText] = useState('');
  const [draftType, setDraftType] = useState<string>('text');
  const [draftRequired, setDraftRequired] = useState(false);
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [eventId]);

  const loadQuestions = async () => {
    try {
      const data = await getEventQuestions(eventId);
      setQuestions(data);
    } catch (error: any) {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!draftText.trim()) {
      toast.error('Question text is required');
      return;
    }

    if ((draftType === 'select' || draftType === 'checkbox') && draftOptions.filter(o => o.trim()).length < 2) {
      toast.error('Please add at least 2 options');
      return;
    }

    setSaving(true);
    try {
      await addQuestion(eventId, {
        question_text: draftText.trim(),
        question_type: draftType as any,
        is_required: draftRequired,
        options: (draftType === 'select' || draftType === 'checkbox')
          ? draftOptions.filter(o => o.trim())
          : null,
        sort_order: questions.length,
      });
      toast.success('Question added');
      resetDraft();
      loadQuestions();
    } catch (error: any) {
      toast.error('Failed to add question: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteQuestion(questionId);
      toast.success('Question removed');
      loadQuestions();
    } catch (error: any) {
      toast.error('Failed to delete question');
    }
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;

    try {
      await Promise.all([
        updateQuestion(questions[index].id, { sort_order: swapIndex }),
        updateQuestion(questions[swapIndex].id, { sort_order: index }),
      ]);
      loadQuestions();
    } catch (error) {
      toast.error('Failed to reorder');
    }
  };

  const handleToggleRequired = async (question: RSVPQuestion) => {
    try {
      await updateQuestion(question.id, { is_required: !question.is_required });
      loadQuestions();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const resetDraft = () => {
    setDraftText('');
    setDraftType('text');
    setDraftRequired(false);
    setDraftOptions([]);
    setShowAddForm(false);
  };

  const needsOptions = draftType === 'select' || draftType === 'checkbox';

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading questions...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Existing questions */}
      {questions.map((q, index) => (
        <Card key={q.id} className="bg-muted/30">
          <CardContent className="p-3 flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {q.question_text}
                {q.is_required && <span className="text-destructive ml-1">*</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {QUESTION_TYPES.find(t => t.value === q.question_type)?.label || q.question_type}
                {q.options && Array.isArray(q.options) && ` · ${(q.options as string[]).length} options`}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleToggleRequired(q)}
                title={q.is_required ? 'Make optional' : 'Make required'}
              >
                <span className={`text-xs font-bold ${q.is_required ? 'text-destructive' : 'text-muted-foreground'}`}>*</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleMoveQuestion(index, 'up')}
                disabled={index === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleMoveQuestion(index, 'down')}
                disabled={index === questions.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDeleteQuestion(q.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add question form */}
      {showAddForm ? (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">New Question</Label>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={resetDraft}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            <Input
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="e.g., What neighborhood do you live in?"
            />

            <div className="flex gap-2 items-center">
              <Select value={draftType} onValueChange={setDraftType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch checked={draftRequired} onCheckedChange={setDraftRequired} id="draft-required" />
                <Label htmlFor="draft-required" className="text-xs">Required</Label>
              </div>
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <Label className="text-xs">Options</Label>
                {draftOptions.map((opt, i) => (
                  <div key={i} className="flex gap-1">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const updated = [...draftOptions];
                        updated[i] = e.target.value;
                        setDraftOptions(updated);
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => setDraftOptions(draftOptions.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraftOptions([...draftOptions, ''])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Option
                </Button>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleAddQuestion}
              disabled={saving}
            >
              {saving ? 'Adding...' : 'Add Question'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Question
        </Button>
      )}

      {questions.length === 0 && !showAddForm && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No custom questions yet. Add questions to collect extra info from RSVPs.
        </p>
      )}
    </div>
  );
};
