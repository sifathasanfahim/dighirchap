import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListOrdered,
  UtensilsCrossed,
  Users,
  Ticket,
  MessageSquareWarning,
  Bike,
  Coins,
  BarChart3,
  LogOut,
  Image as ImageIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Bell,
  Volume2,
  VolumeX,
  ChevronRight,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ensureNotificationPermission, showBrowserNotification } from "@/lib/notifications";
import { sfx, setSoundsMuted, isSoundsMuted } from "@/lib/sounds";
import { toast } from "sonner";
import { fmtBDT } from "@/lib/format";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  emoji: string;
};

type NavSection = { label: string; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, emoji: "📊" },
      { to: "/admin/orders", label: "Orders", icon: ListOrdered, emoji: "🧾" },
      { to: "/admin/notifications", label: "Notifications", icon: Bell, emoji: "🔔" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed, emoji: "🍱" },
      { to: "/admin/banners", label: "Banners", icon: ImageIcon, emoji: "🖼️" },
      { to: "/admin/popups", label: "Popups", icon: ImageIcon, emoji: "✨" },
      { to: "/admin/coupons", label: "Coupons", icon: Ticket, emoji: "🎟️" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/customers", label: "Customers", icon: Users, emoji: "👥" },
      { to: "/admin/riders", label: "Riders", icon: Bike, emoji: "🛵" },
      { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning, emoji: "💬" },
      { to: "/admin/loyalty", label: "Loyalty", icon: Coins, emoji: "🪙" },
    ],
  },
  {
    label: "System",
    items: [{ to: "/admin/settings", label: "Settings", icon: SettingsIcon, emoji: "⚙️" }],
  },
];

const ownerSections: NavSection[] = [
  { label: "Insights", items: [{ to: "/owner", label: "Analytics", icon: BarChart3, emoji: "📈" }] },
  ...adminSections,
];

export function StaffShell({
  children,
  title,
  variant = "admin",
}: {
  children: ReactNode;
  title: string;
  variant?: "admin" | "owner" | "rider";
}) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(isSoundsMuted());
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const sections = variant === "owner" ? ownerSections : variant === "rider" ? [] : adminSections;

  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((p, i) => ({
      label: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      to: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [pathname]);

  useEffect(() => {
    if (variant === "rider") return;
    ensureNotificationPermission();
    const channel = supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
        const o = payload.new;
        sfx.newOrder();
        const t = `🛎️ New order ${o.order_number ?? ""}`.trim();
        const body = `${fmtBDT(Number(o.total) || 0)} • ${o.status ?? "pending"}`;
        toast.success(t, { description: body, duration: 8000 });
        showBrowserNotification(t, body);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [variant]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundsMuted(next);
    if (!next) sfx.notify();
  };

  const signOut = async () => {
    sfx.click();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar transition-transform md:static md:translate-x-0",
          open && "translate-x-0",
        )}
      >
        {/* Workspace switcher */}
        <div className="flex items-center gap-2 px-3 py-3">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-xs font-bold">
            D
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight">Dighir Chap</div>
            <div className="text-[11px] capitalize text-muted-foreground">{variant} workspace</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border border-transparent bg-sidebar-accent/60 px-2 py-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-auto rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </div>
        </div>

        {/* Quick action */}
        <div className="px-3 pb-2">
          <Link
            to="/admin/menu"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New item
          </Link>
        </div>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {sections.map((sec) => (
            <div key={sec.label} className="mt-3">
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {sec.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {sec.items.map((n) => {
                  const active = pathname === n.to;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent",
                      )}
                    >
                      <span className="grid h-5 w-5 place-items-center text-[14px] leading-none">
                        {n.emoji}
                      </span>
                      <span className="truncate">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="m-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--notion-page)]">
        <header className="sticky top-0 z-20 flex h-11 items-center gap-2 border-b border-border bg-[var(--notion-page)]/95 px-4 backdrop-blur">
          <button className="md:hidden" onClick={() => setOpen((o) => !o)}>
            <MenuIcon className="h-4 w-4" />
          </button>
          <nav className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.to} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                <span className={cn("truncate", i === crumbs.length - 1 && "text-foreground font-medium")}>
                  {c.label}
                </span>
              </span>
            ))}
          </nav>
          <button
            onClick={toggleMute}
            title={muted ? "Unmute UI sounds" : "Mute UI sounds"}
            className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-muted"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-6 pt-10 pb-4 md:px-12">
            <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-foreground">{title}</h1>
          </div>
          <div className="mx-auto w-full max-w-6xl px-6 pb-12 md:px-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
