import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Phone } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Dighir Chap" }] }),
  component: ComplaintsPage,
});

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
};

function ComplaintsPage() {
  const { userId } = Route.useRouteContext();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const settings = useQuery({
    queryKey: ["app-settings-public"],
    queryFn: async () =>
      (await (supabase as any).from("app_settings").select("support_phone").eq("id", 1).maybeSingle()).data,
  });
  const supportPhone: string = settings.data?.support_phone?.trim() ?? "";

  const orders = useQuery({
    queryKey: ["my-orders-simple", userId],
    queryFn: async () =>
      (await supabase.from("orders").select("id, order_number").eq("customer_id", userId).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const complaints = useQuery({
    queryKey: ["my-complaints", userId],
    queryFn: async () =>
      (await supabase.from("complaints").select("*").eq("customer_id", userId).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("complaints").insert({
      customer_id: userId,
      subject: subject.trim(),
      message: message.trim(),
      order_id: orderId === "none" ? null : orderId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Complaint submitted");
    setSubject("");
    setMessage("");
    setOrderId("none");
    complaints.refetch();
  };

  return (
    <CustomerShell>
      <div className="space-y-6">
        {supportPhone && (
          <a
            href={`tel:${supportPhone.replace(/\s+/g, "")}`}
            className="flex items-center justify-between gap-3 rounded-2xl border bg-primary p-4 text-primary-foreground shadow hover:bg-primary/90"
          >
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Need help now?</div>
              <div className="text-lg font-bold">Call {supportPhone}</div>
            </div>
            <Phone className="h-6 w-6" />
          </a>
        )}

        <div>
          <h1 className="text-2xl font-bold">Help & Complaints</h1>
          <p className="text-sm text-muted-foreground">Tell us what went wrong — we'll get back to you.</p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
          </div>
          <div className="space-y-1.5">
            <Label>Related order (optional)</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {orders.data?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>#{o.order_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue" />
          </div>
          <Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit complaint"}</Button>
        </form>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your complaints</h2>
          {complaints.data?.length === 0 && (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">No complaints yet.</div>
          )}
          {complaints.data?.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{c.subject}</h3>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{c.message}</p>
                  {c.resolution && (
                    <div className="mt-2 rounded-lg bg-muted p-2 text-sm">
                      <span className="font-medium">Response: </span>{c.resolution}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">{fmtDate(c.created_at)}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[c.status] ?? ""}`}>
                  {c.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CustomerShell>
  );
}
