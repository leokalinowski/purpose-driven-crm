
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";

export default function Newsletter() {
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("<h2>Hello!</h2><p>This is a test email from our app.</p>");

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !subject) {
      toast({ title: "Missing info", description: "Please fill To and Subject." });
      return;
    }

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to,
        subject,
        html: message,
      },
    });

    if (error) {
      console.error("send-email error:", error);
      toast({
        title: "Failed to send",
        description: error.message ?? "Please check the logs.",
      });
      return;
    }

    console.log("send-email response:", data);
    toast({
      title: "Email queued",
      description: "SendGrid accepted the request.",
    });
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Send a test email</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSend} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">To</label>
                <Input
                  placeholder="recipient@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  type="email"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Subject</label>
                <Input
                  placeholder="Welcome!"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">HTML Message</label>
                <Textarea
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Tip: The server will add a footer with your company address if configured.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="submit">Send</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
