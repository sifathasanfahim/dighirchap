import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () =>
      (await (supabase as any).from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  useEffect(() => {
    if (settings.data) setPhone(settings.data.support_phone ?? "");
  }, [settings.data]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert({ id: 1, support_phone: phone.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <StaffShell title="Settings">
      <div className="max-w-md space-y-4 rounded-2xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Support phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+8801XXXXXXXXX"
          />
          <p className="text-xs text-muted-foreground">
            Shown as a Call button on the customer Help page.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </StaffShell>
  );
}
