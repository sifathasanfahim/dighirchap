import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Popup = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  start_at: string | null;
  end_at: string | null;
  sort_order: number;
};

const STORAGE_PREFIX = "popup-seen-";

export function PopupBanner() {
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await (supabase as any)
        .from("popup_banners")
        .select("*")
        .eq("active", true)
        .or(`start_at.is.null,start_at.lte.${nowIso}`)
        .or(`end_at.is.null,end_at.gte.${nowIso}`)
        .order("sort_order", { ascending: true })
        .limit(1);
      if (cancelled) return;
      const p = (data ?? [])[0] as Popup | undefined;
      if (!p) return;
      try {
        if (sessionStorage.getItem(STORAGE_PREFIX + p.id)) return;
      } catch {
        /* ignore */
      }
      setPopup(p);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!popup) return null;

  const close = () => {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + popup.id, "1");
    } catch {
      /* ignore */
    }
    setPopup(null);
  };

  const inner = (
    <img
      src={popup.image_url}
      alt={popup.title ?? "Promotion"}
      className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
    />
  );

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 animate-in fade-in"
      onClick={close}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={close}
          aria-label="Close"
          className="absolute -right-2 -top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow-lg hover:scale-105 transition"
        >
          <X className="h-5 w-5" />
        </button>
        {popup.link_url ? (
          <a href={popup.link_url} onClick={close}>
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    </div>
  );
}
