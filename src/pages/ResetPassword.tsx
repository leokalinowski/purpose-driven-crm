import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import authBackground from "@/assets/auth-background.jpg";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setHasRecoverySession(!!data.session);
      })
      .finally(() => {
        if (cancelled) return;
        setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const validationError = useMemo(() => {
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid password.";
    if (confirmPassword && newPassword !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [newPassword, confirmPassword]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      toast({
        title: "Invalid password",
        description: parsed.error.issues[0]?.message ?? "Please choose a stronger password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please re-type your password.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) {
        toast({
          title: "Could not update password",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Password updated", description: "You can now continue to the app." });
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({
        title: "Unexpected error",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(180, 100%, 35%) 50%, hsl(180, 60%, 45%) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <Card className="w-full max-w-md backdrop-blur-lg bg-white/90 border-white/30 shadow-2xl animate-scale-in relative z-10">
        <CardHeader className="text-center">
          <CardDescription className="text-gray-600 text-lg font-medium">
            Set a new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <div className="text-sm text-gray-600">Checking reset link…</div>
          ) : !hasRecoverySession ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate("/auth", { replace: true })}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-gray-700 font-medium">
                  New password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                  placeholder="Enter a new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-primary focus:ring-primary/20"
                  placeholder="Re-enter your new password"
                />
              </div>

              {validationError && (
                <p className="text-sm text-gray-600">{validationError}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                disabled={saving || !!validationError}
              >
                {saving ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
