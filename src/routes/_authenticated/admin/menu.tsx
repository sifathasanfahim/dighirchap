import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, Loader2, X } from "lucide-react";
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
  image_url: string;
  is_top_pick: boolean;
}

const empty: ItemForm = { name: "", description: "", price: "", category_id: "", available: true, image_url: "", is_top_pick: false };


function AdminMenu() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(empty);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const items = useQuery({
    queryKey: ["admin-items"],
    queryFn: async () => (await supabase.from("menu_items").select("*, categories(name)").order("name")).data ?? [],
  });

  const filteredItems = filterCat === "all"
    ? items.data
    : items.data?.filter((i) => i.category_id === filterCat);

  const save = async () => {
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category_id: form.category_id || null,
      available: form.available,
      image_url: form.image_url || null,
      is_top_pick: form.is_top_pick,
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

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > 1024 * 1024) return toast.error("Image is too large. Max 1 MB.");
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("menu-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw up.error;
      // Long-lived signed URL (10 years) so it works with a private bucket
      const signed = await supabase.storage
        .from("menu-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error) throw signed.error;
      setForm((f) => ({ ...f, image_url: signed.data.signedUrl }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const del = async (id: string) => {
    if (!confirm("Delete item?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); items.refetch(); }
  };

  return (
    <StaffShell title="Menu">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">Filter category:</Label>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ ...empty, category_id: filterCat !== "all" ? filterCat : "" })}>
              <Plus className="mr-2 h-4 w-4" /> Add item{filterCat !== "all" ? ` to ${categories.data?.find((c) => c.id === filterCat)?.name ?? ""}` : ""}
            </Button>
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
              <div className="flex items-center gap-2"><Switch checked={form.is_top_pick} onCheckedChange={(v) => setForm({ ...form, is_top_pick: v })} /><Label>Show in Top picks</Label></div>

              <div>
                <Label>Image</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Max 1 MB · recommended 800×800 px (square) or 1200×800 px. Use JPG/WebP for smooth loading.
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                />
                {form.image_url ? (
                  <div className="relative mt-1 overflow-hidden rounded-lg border">
                    <img src={form.image_url} alt="" className="h-40 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/95 text-foreground shadow"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-2 right-2 rounded-full bg-background/95 px-3 py-1 text-xs font-medium shadow"
                    >
                      {uploading ? "Uploading…" : "Replace"}
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1 w-full"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading…" : "Upload image"}
                  </Button>
                )}
              </div>

              <Button onClick={save} className="w-full">Save</Button>

            </div>
          </DialogContent>
        </Dialog>
        <div className="ml-auto text-sm text-muted-foreground">{filteredItems?.length ?? 0} items</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems?.map((i) => (
          <div key={i.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{i.name}</h3>
                <div className="text-xs text-muted-foreground">{i.categories?.name}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ id: i.id, name: i.name, description: i.description ?? "", price: String(i.price), category_id: i.category_id ?? "", available: i.available, image_url: i.image_url ?? "", is_top_pick: (i as any).is_top_pick ?? false }); setOpen(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
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
        {filteredItems?.length === 0 && <div className="col-span-full rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No items in this category yet. Click "Add item" to create one.</div>}
      </div>
    </StaffShell>
  );
}
