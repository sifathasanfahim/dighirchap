import { Bell, ShoppingBag, Sparkles, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ToastKind = "order" | "promo" | "system" | "success";

const KIND_META: Record<ToastKind, { icon: typeof Bell; ring: string; tint: string; iconBg: string }> = {
  order: {
    icon: ShoppingBag,
    ring: "ring-emerald-500/40",
    tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500 text-white",
  },
  promo: {
    icon: Sparkles,
    ring: "ring-primary/40",
    tint: "from-primary/15 via-primary/5 to-transparent",
    iconBg: "bg-primary text-primary-foreground",
  },
  system: {
    icon: Bell,
    ring: "ring-primary/30",
    tint: "from-primary/10 via-primary/5 to-transparent",
    iconBg: "bg-primary text-primary-foreground",
  },
  success: {
    icon: CheckCircle2,
    ring: "ring-emerald-500/40",
    tint: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500 text-white",
  },
};

export function showPrettyToast(opts: {
  title: string;
  body?: string;
  kind?: ToastKind;
  image?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}) {
  const kind = opts.kind ?? "system";
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  toast.custom(
    (id) => (
      <div
        className={cn(
          "pointer-events-auto w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border bg-background shadow-2xl ring-1",
          meta.ring,
        )}
        style={{ animation: "pretty-toast-in 260ms cubic-bezier(.2,.9,.2,1)" }}
      >
        <div className={cn("relative bg-gradient-to-br p-4", meta.tint)}>
          <button
            onClick={() => toast.dismiss(id)}
            aria-label="Dismiss"
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div
              className={cn(
                "grid h-10 w-10 flex-none place-items-center rounded-xl shadow-md",
                meta.iconBg,
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                {opts.title}
              </p>
              {opts.body && (
                <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-muted-foreground">
                  {opts.body}
                </p>
              )}
              {opts.image && (
                <img
                  src={opts.image}
                  alt=""
                  className="mt-2 h-24 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              {opts.actionLabel && opts.onAction && (
                <button
                  onClick={() => {
                    opts.onAction!();
                    toast.dismiss(id);
                  }}
                  className="mt-3 inline-flex items-center rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
                >
                  {opts.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { duration: opts.duration ?? 6000 },
  );
}
