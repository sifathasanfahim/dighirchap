import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ComplaintStatus = Database["public"]["Enums"]["complaint_status"];

export const Route = createFileRoute("/_authenticated/admin/complaints")({
  component: AdminComplaints,
});

function AdminComplaints() {
  const complaints = useQuery({
    queryKey: ["admin-complaints"],
    queryFn: async () => (await supabase.from("complaints").select("*, profiles!complaints_customer_id_fkey(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const update = async (id: string, status: ComplaintStatus) => {
    const { error } = await supabase.from("complaints").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); complaints.refetch(); }
  };

  return (
    <StaffShell title="Complaints">
      <div className="space-y-3">
        {complaints.data?.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{c.subject}</h3>
                  <span className="text-xs text-muted-foreground">by {c.profiles?.full_name ?? "—"}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.message}</p>
                <div className="mt-1 text-xs text-muted-foreground">{fmtDate(c.created_at)}</div>
              </div>
              <Select value={c.status} onValueChange={(v) => update(c.id, v as ComplaintStatus)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {complaints.data?.length === 0 && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No complaints.</div>}
      </div>
    </StaffShell>
  );
}
