import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/riders")({
  component: AdminRiders,
});

function AdminRiders() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ profile_id: "", vehicle: "" });

  const riders = useQuery({
    queryKey: ["admin-riders"],
    queryFn: async () => (await supabase.from("riders").select("*, profiles(full_name, phone)").order("created_at", { ascending: false })).data ?? [],
  });

  const customers = useQuery({
    queryKey: ["all-profiles-for-rider"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, phone").order("full_name")).data ?? [],
  });

  const addRider = async () => {
    if (!form.profile_id) return toast.error("Pick a profile");
    const { error: rErr } = await supabase.from("riders").insert({ profile_id: form.profile_id, vehicle: form.vehicle });
    if (rErr) return toast.error(rErr.message);
    const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: form.profile_id, role: "rider" });
    if (roleErr && !roleErr.message.includes("duplicate")) toast.error(roleErr.message);
    toast.success("Rider added");
    setOpen(false);
    setForm({ profile_id: "", vehicle: "" });
    riders.refetch();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("riders").update({ active }).eq("id", id);
    riders.refetch();
  };

  const remove = async (id: string, profileId: string) => {
    if (!confirm("Remove rider?")) return;
    await supabase.from("riders").delete().eq("id", id);
    await supabase.from("user_roles").delete().eq("user_id", profileId).eq("role", "rider");
    riders.refetch();
  };

  return (
    <StaffShell title="Riders">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="mb-4"><Plus className="mr-2 h-4 w-4" /> Add rider</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add rider</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer to promote</Label>
              <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {customers.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.phone ?? p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Vehicle</Label><Input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="Bike / Scooter" /></div>
            <Button onClick={addRider} className="w-full">Add</Button>
          </div>
        </DialogContent>
      </Dialog>

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
