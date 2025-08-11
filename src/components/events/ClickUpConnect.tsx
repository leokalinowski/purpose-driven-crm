import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCcw } from "lucide-react";

type Props = {
  teamId: string;
  listId: string;
  tag?: string;
  eventId?: string;
};

export function ClickUpConnect({ teamId, listId, tag = "event", eventId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleLinkAndSync = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("clickup-register-and-sync", {
        body: { team_id: teamId, list_id: listId, tag, event_id: eventId },
      });
      if (error) throw error;
      toast({
        title: "ClickUp linked",
        description: `Webhook ${(data as any)?.webhook_id ? "created" : "ok"}. Inserted ${(data as any)?.inserted ?? 0} tasks.`,
      });
    } catch (err: any) {
      toast({
        title: "ClickUp link failed",
        description: err?.message || "Please check your permissions and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Link your REOP HQ Action Items list to the next event and sync tasks tagged "event" (including subtasks).
        </div>
        <Button onClick={handleLinkAndSync} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          {loading ? "Linking..." : "Link & Sync ClickUp"}
        </Button>
      </CardContent>
    </Card>
  );
}
