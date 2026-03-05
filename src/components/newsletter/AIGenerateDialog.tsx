import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Loader2, TrendingUp, Calendar, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AIGenerateDialogProps {
  open: boolean;
  onClose: () => void;
}

const getSeason = () => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
};

const defaultPrompts = {
  market: 'Write a newsletter featuring current real estate market data and trends for my area. Include median home prices, inventory levels, days on market, and what this means for buyers and sellers right now.',
  seasonal: `Write a newsletter about the ${getSeason()} ${new Date().getFullYear()} real estate market. Cover seasonal buying/selling trends, what homeowners should be doing this time of year, and market outlook for the coming months.`,
  educational: 'Write an educational newsletter about the real estate process. Cover topics like home maintenance tips, understanding title insurance, how the transaction process works from offer to closing, or general homeownership advice that provides value to your database.',
};

type PromptType = 'market' | 'seasonal' | 'educational';

export function AIGenerateDialog({ open, onClose }: AIGenerateDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType>('market');
  const [prompts, setPrompts] = useState(defaultPrompts);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-newsletter', {
        body: { agent_id: user.id, topic_hint: prompts[selectedPrompt] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'AI Newsletter Generated', description: `Draft created with ${data.block_count} blocks.` });
      onClose();
      setPrompts(defaultPrompts);
      setSelectedPrompt('market');
      navigate(`/newsletter-builder/${data.template_id}`);
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const promptOptions: { key: PromptType; label: string; icon: typeof TrendingUp }[] = [
    { key: 'market', label: 'Market Data', icon: TrendingUp },
    { key: 'seasonal', label: 'Seasonal', icon: Calendar },
    { key: 'educational', label: 'Educational', icon: FileText },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setPrompts(defaultPrompts); setSelectedPrompt('market'); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate AI Newsletter
          </DialogTitle>
          <DialogDescription>
            Select a prompt template and customize it before generating.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={selectedPrompt} onValueChange={(v) => setSelectedPrompt(v as PromptType)} className="space-y-3 py-2">
          {promptOptions.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className={`rounded-lg border p-3 cursor-pointer transition-colors ${selectedPrompt === key ? 'border-primary bg-primary/5' : 'border-border'}`}
              onClick={() => setSelectedPrompt(key)}
            >
              <div className="flex items-center gap-2 mb-2">
                <RadioGroupItem value={key} id={`ai-${key}`} />
                <Label htmlFor={`ai-${key}`} className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <Icon className="h-4 w-4" />
                  {label}
                </Label>
              </div>
              <Textarea
                value={prompts[key]}
                onChange={(e) => setPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                disabled={isGenerating || selectedPrompt !== key}
                className="min-h-[80px] text-sm"
                rows={3}
              />
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
