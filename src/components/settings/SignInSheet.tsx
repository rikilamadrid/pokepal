"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { signInSchema } from "@/lib/auth-schema";

interface SignInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Magic-link sign-in dialog. A parent enters their email; Supabase sends a
 * passwordless link that signs the app in when opened. No passwords, no
 * third-party data sharing — kid-safe. Validated with Zod.
 */
export function SignInSheet({ open, onOpenChange }: SignInSheetProps) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setEmail("");
    setSending(false);
    setSent(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setSending(true);
    try {
      await signInWithEmail(parsed.data.email);
      setSent(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn’t send the link. Try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wide">
            {sent ? "Check your email" : "Sign in to back up"}
          </DialogTitle>
          <DialogDescription>
            {sent
              ? `We sent a magic link to ${email}. Open it on this device to sign in — no password needed.`
              : "Enter a parent’s email. We’ll send a magic link — tap it to sign in and keep your cards safe across devices."}
          </DialogDescription>
        </DialogHeader>

        {!sent && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="parent@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
              autoFocus
            />
            <Button
              type="submit"
              disabled={sending}
              className="bg-red text-white hover:bg-red/90"
            >
              {sending ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
