import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil, Upload } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/popups")({
  component: AdminPopups,
});

type Popup = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  active: boolean;
  sort_order: number;
  start_at: string | null;
  end_at: string | null;
};

const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const empty = {
  id: "",
  title: "",
  image_url: "",
  link_url: "",
  active: true,
  sort_order: 0,
  start_at: "",
  end_at: "",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminPopups() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [uploading, setUploading] = useState(false);

  const popups = useQuery({
    queryKey: ["admin-popups"],
    queryFn: async () =>
      ((await (supabase as any)
        .from("popup_banners")
        .select("*")
        .order("sort_order", { ascending: true })).data ?? []) as Popup[],
  });

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(`Image must be under ${MAX_MB} MB`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `popups/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from("menu-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.image_url.trim()) return toast.error("Upload an image first");
    const payload = {
      title: form.title || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url || null,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
    };
    const res = form.id
      ? await (supabase as any).from("popup_banners").update(payload).eq("id", form.id)
      : await (supabase as any).from("popup_banners").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(form.id ? "Popup updated" : "Popup added");
    setOpen(false);
    setForm({ ...empty });
    qc.invalidateQueries({ queryKey: ["admin-popups"] });
    qc.invalidateQueries({ queryKey: ["active-popup"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this popup?")) return;
    const { error } = await (supabase as any).from("popup_banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-popups"] });
    qc.invalidateQueries({ queryKey: ["active-popup"] });
  };

  const edit = (p: Popup) => {
    setForm({
      id: p.id,
      title: p.title ?? "",
      image_url: p.image_url,
      link_url: p.link_url ?? "",
      active: p.active,
      sort_order: p.sort_order,
      start_at: toLocalInput(p.start_at),
      end_at: toLocalInput(p.end_at),
    });
    setOpen(true);
  };

  return (
    <StaffShell title="Popup Banners">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Shown to visitors once per session. Max image size {MAX_MB} MB. Recommended 800×800.
        </p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm({ ...empty }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add popup</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit popup" : "New popup"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Design image * (max {MAX_MB} MB)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f);
                    }}
                  />
                  {uploading && <Upload className="h-4 w-4 animate-pulse" />}
                </div>
                {form.image_url && (
                  <div className="overflow-hidden rounded-lg border">
                    <img src={form.image_url} alt="" className="max-h-56 w-full object-contain" />
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Title (optional)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Link on click (optional)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="/menu"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Start at</Label>
                  <Input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>End at</Label>
                  <Input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                  />
                </div>
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
              <Button onClick={save} disabled={uploading}>
                {form.id ? "Save changes" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(popups.data ?? []).map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl border bg-card">
            <img src={p.image_url} alt={p.title ?? ""} className="h-48 w-full object-contain bg-muted" />
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.title || "Untitled"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  #{p.sort_order} · {p.active ? "Active" : "Hidden"}
                  {p.start_at ? ` · from ${new Date(p.start_at).toLocaleString()}` : ""}
                  {p.end_at ? ` · until ${new Date(p.end_at).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => edit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {popups.data && popups.data.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No popups yet. Click "Add popup" to create one.
          </div>
        ) : null}
      </div>
    </StaffShell>
  );
}
