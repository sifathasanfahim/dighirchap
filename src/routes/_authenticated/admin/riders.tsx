import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createRiderAccount } from "@/lib/admin-rider.functions";

export const Route = createFileRoute("/_authenticated/admin/riders")({
  component: AdminRiders,
});

function AdminRiders() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rider_id: "", password: "", full_name: "", phone: "", vehicle: "" });
  const [saving, setSaving] = useState(false);
  const createRider = useServerFn(createRiderAccount);

  const riders = useQuery({
    queryKey: ["admin-riders"],
    queryFn: async () => (await supabase.from("riders").select("*, profiles(full_name, phone)").order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    setSaving(true);
    try {
      const res = await createRider({ data: form });
      toast.success(`Rider created. Login ID: ${res.rider_id}`);
      setOpen(false);
      setForm({ rider_id: "", password: "", full_name: "", phone: "", vehicle: "" });
      riders.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("riders").update({ active }).eq("id", id);
    riders.refetch();
  };

  const remove = async (id: string, profileId: string) => {
    if (!confirm("Remove rider? This unassigns them from rider role.")) return;
    await supabase.from("riders").delete().eq("id", id);
    await supabase.from("user_roles").delete().eq("user_id", profileId).eq("role", "rider");
    riders.refetch();
  };

  return (
    <StaffShell title="Riders">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Create a rider account with a login ID + password. The rider signs in on the normal login page and lands in the rider portal automatically.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add rider</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add rider</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Rider login ID</Label>
                <Input value={form.rider_id} onChange={(e) => setForm({ ...form, rider_id: e.target.value })} placeholder="e.g. rider01" />
                <p className="mt-1 text-xs text-muted-foreground">Letters/numbers/._- only. Rider will sign in with this ID.</p>
              </div>
              <div>
                <Label>Password</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
              </div>
              <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
              <div><Label>Vehicle</Label><Input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="Bike / Scooter" /></div>
              <Button onClick={submit} className="w-full" disabled={saving}>
                <KeyRound className="mr-2 h-4 w-4" /> {saving ? "Creating..." : "Create rider account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-left">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {riders.data?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.profiles?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{r.profiles?.phone ?? "—"}</td>
                <td className="px-4 py-3">{r.vehicle}</td>
                <td className="px-4 py-3"><Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} /></td>
                <td className="px-4 py-3 text-right"><button onClick={() => remove(r.id, r.profile_id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
