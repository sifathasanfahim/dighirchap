import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtBDT, fmtDate } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type CouponType = Database["public"]["Enums"]["coupon_type"];

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: AdminCoupons,
});

function AdminCoupons() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", type: "flat" as CouponType, value: "", min_order: "" });

  const coupons = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    const { error } = await supabase.from("coupons").insert({
      code: form.code.toUpperCase(),
      type: form.type,
      value: Number(form.value || 0),
      min_order: Number(form.min_order || 0),
    });
    if (error) return toast.error(error.message);
    toast.success("Coupon created");
    setOpen(false);
    setForm({ code: "", type: "flat", value: "", min_order: "" });
    coupons.refetch();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active }).eq("id", id);
    coupons.refetch();
  };

  const del = async (id: string) => {
    if (!confirm("Delete coupon?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    coupons.refetch();
  };

  return (
    <StaffShell title="Coupons">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="mb-4"><Plus className="mr-2 h-4 w-4" /> New coupon</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CouponType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat ৳ off</SelectItem>
                  <SelectItem value="percent">% off</SelectItem>
                  <SelectItem value="free_delivery">Free delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div><Label>Min order</Label><Input type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} /></div>
            <Button onClick={create} className="w-full">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.data?.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold tracking-wide text-primary">{c.code}</div>
                <div className="text-xs capitalize text-muted-foreground">{c.type.replace("_", " ")} {c.type !== "free_delivery" && `• ${c.type === "percent" ? `${c.value}%` : fmtBDT(c.value)}`}</div>
                <div className="text-xs text-muted-foreground">Min {fmtBDT(c.min_order)} • added {fmtDate(c.created_at)}</div>
              </div>
              <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <button
              onClick={() => toggle(c.id, !c.active)}
              className={`mt-3 w-full rounded-md px-3 py-1 text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
            >
              {c.active ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
      </div>
    </StaffShell>
  );
}
