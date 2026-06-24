import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  component: AdminBanners,
});

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  active: boolean;
};

const empty = {
  id: "",
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  sort_order: 0,
  active: true,
};

function AdminBanners() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const banners = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () =>
      ((await (supabase as any)
        .from("promo_banners")
        .select("*")
        .order("sort_order", { ascending: true })).data ?? []) as Banner[],
  });

  const save = async () => {
    if (!form.image_url.trim()) return toast.error("Image URL is required");
    const payload = {
      title: form.title || null,
      subtitle: form.subtitle || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url || null,
      sort_order: Number(form.sort_order) || 0,
      active: form.active,
    };
    const res = form.id
      ? await (supabase as any).from("promo_banners").update(payload).eq("id", form.id)
      : await (supabase as any).from("promo_banners").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(form.id ? "Banner updated" : "Banner added");
    setOpen(false);
    setForm({ ...empty });
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["home-banners"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    const { error } = await (supabase as any).from("promo_banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["home-banners"] });
  };

  const edit = (b: Banner) => {
    setForm({
      id: b.id,
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      image_url: b.image_url,
      link_url: b.link_url ?? "",
      sort_order: b.sort_order,
      active: b.active,
    });
    setOpen(true);
  };

  return (
    <StaffShell title="Hero Banners">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Slides that appear on the customer home hero. Recommended 1200×600 image.
        </p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm({ ...empty }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add banner</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit banner" : "New banner"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Image URL *</Label>
                <Input
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Get 50% Off"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Subtitle</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Use code FIRST50 at checkout"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Link (optional)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="/menu"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              {form.image_url ? (
                <div className="overflow-hidden rounded-lg border">
                  <img src={form.image_url} alt="" className="h-40 w-full object-cover" />
                </div>
              ) : null}
              <Button onClick={save}>{form.id ? "Save changes" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(banners.data ?? []).map((b) => (
          <div key={b.id} className="overflow-hidden rounded-2xl border bg-card">
            <img src={b.image_url} alt={b.title ?? ""} className="h-40 w-full object-cover" />
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{b.title || "Untitled"}</div>
                <div className="truncate text-xs text-muted-foreground">{b.subtitle}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  #{b.sort_order} · {b.active ? "Active" : "Hidden"}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => edit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {banners.data && banners.data.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No banners yet. Click "Add banner" to create your first hero slide.
          </div>
        ) : null}
      </div>
    </StaffShell>
  );
}
