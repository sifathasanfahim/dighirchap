import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtBDT } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/menu")({
  component: AdminMenu,
});

interface ItemForm {
  id?: string;
  name: string;
  description: string;
  price: string;
  category_id: string;
  available: boolean;
}

const empty: ItemForm = { name: "", description: "", price: "", category_id: "", available: true };

function AdminMenu() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(empty);

  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const items = useQuery({
    queryKey: ["admin-items"],
    queryFn: async () => (await supabase.from("menu_items").select("*, categories(name)").order("name")).data ?? [],
  });

  const save = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category_id: form.category_id || null,
      available: form.available,
    };
    const op = form.id
      ? supabase.from("menu_items").update(payload).eq("id", form.id)
      : supabase.from("menu_items").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    setForm(empty);
    items.refetch();
  };

  const del = async (id: string) => {
    if (!confirm("Delete item?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); items.refetch(); }
  };

  return (
    <StaffShell title="Menu">
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogTrigger asChild>
          <Button className="mb-4"><Plus className="mr-2 h-4 w-4" /> Add item</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "Add"} item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Price</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} /><Label>Available</Label></div>
            <Button onClick={save} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.data?.map((i) => (
          <div key={i.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{i.name}</h3>
                <div className="text-xs text-muted-foreground">{i.categories?.name}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ id: i.id, name: i.name, description: i.description ?? "", price: String(i.price), category_id: i.category_id ?? "", available: i.available }); setOpen(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(i.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{i.description}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-bold text-primary">{fmtBDT(i.price)}</span>
              {!i.available && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-800">Unavailable</span>}
            </div>
          </div>
        ))}
      </div>
    </StaffShell>
  );
}
