import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Send, Megaphone } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { sendPush } from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
});

function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "user">("all");
  const [userId, setUserId] = useState("");
  const [sending, setSending] = useState(false);

  const recent = useQuery({
    queryKey: ["admin-notifications-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  const send = async () => {
    if (!title.trim()) return toast.error("Title required");
    setSending(true);
    const payload: any = {
      title: title.trim(),
      body: body.trim() || null,
      is_broadcast: target === "all",
      user_id: target === "user" ? userId.trim() : null,
    };
    const { error } = await supabase.from("notifications").insert(payload);
    if (error) {
      setSending(false);
      sfx.error();
      return toast.error(error.message);
    }
    // Fire OS-level push in parallel.
    let pushResult: { sent: number; failed: number } | null = null;
    try {
      pushResult = await sendPush({
        data: {
          target: target === "all" ? "all" : "user",
          userId: target === "user" ? userId.trim() : null,
          payload: {
            title: title.trim(),
            body: body.trim() || undefined,
            type: "system",
          },
        },
      });
    } catch (e: any) {
      console.warn("push send failed", e);
    }
    setSending(false);
    sfx.success();
    toast.success(
      target === "all" ? "Broadcast sent" : "Notification sent",
      pushResult ? { description: `Push: ${pushResult.sent} delivered, ${pushResult.failed} failed` } : undefined,
    );
    setTitle("");
    setBody("");
    recent.refetch();
  };

  return (
    <StaffShell title="Push Notifications">
      <div className="grid gap-6 md:grid-cols-[1fr,1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Compose</h2>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Send to</Label>
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant={target === "all" ? "default" : "outline"} onClick={() => setTarget("all")}>
                  All customers
                </Button>
                <Button size="sm" variant={target === "user" ? "default" : "outline"} onClick={() => setTarget("user")}>
                  Specific user
                </Button>
              </div>
            </div>
            {target === "user" && (
              <div>
                <Label>User ID</Label>
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="auth user uuid" />
                <p className="mt-1 text-xs text-muted-foreground">Find on the Customers page.</p>
              </div>
            )}
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="🎉 Big offer today!" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Tap to view details…" />
            </div>
            <Button onClick={send} disabled={sending} className="w-full">
              <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Send notification"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Users with the site open in any tab will see a browser notification + in-app toast. Users must allow notifications once.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Recent</h2>
          <div className="space-y-2">
            {recent.data?.length === 0 && <p className="text-sm text-muted-foreground">Nothing sent yet.</p>}
            {recent.data?.map((n: any) => (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{n.title}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${n.is_broadcast ? "bg-primary/15 text-primary" : "bg-muted"}`}>
                    {n.is_broadcast ? "Broadcast" : "Direct"}
                  </span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
