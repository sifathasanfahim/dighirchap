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
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ensureNotificationPermission, showBrowserNotification } from "@/lib/notifications";
import { sfx, setSoundsMuted, isSoundsMuted } from "@/lib/sounds";
import { toast } from "sonner";
import { fmtBDT } from "@/lib/format";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: ListOrdered },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon },
  { to: "/admin/popups", label: "Popups", icon: ImageIcon },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning },
  { to: "/admin/riders", label: "Riders", icon: Bike },
  { to: "/admin/loyalty", label: "Loyalty", icon: Coins },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

const ownerNav: NavItem[] = [{ to: "/owner", label: "Analytics", icon: BarChart3 }];

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

  const nav = variant === "owner" ? [...ownerNav, ...adminNav] : variant === "rider" ? [] : adminNav;

  // New-order realtime alert for admin/owner
  useEffect(() => {
    if (variant === "rider") return;
    ensureNotificationPermission();
    const channel = supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
        const o = payload.new;
        sfx.newOrder();
        const title = `🛎️ New order ${o.order_number ?? ""}`.trim();
        const body = `${fmtBDT(Number(o.total) || 0)} • ${o.status ?? "pending"}`;
        toast.success(title, { description: body, duration: 8000 });
        showBrowserNotification(title, body);
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
    <div className="flex min-h-screen bg-muted/40">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r bg-sidebar transition-transform md:static md:translate-x-0",
          open && "translate-x-0",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">D</div>
          <div>
            <div className="text-sm font-bold leading-none">Dighir Chap</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {variant === "owner" ? "Owner" : variant === "rider" ? "Rider" : "Admin"}
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <button className="md:hidden" onClick={() => setOpen((o) => !o)}>
            <MenuIcon className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold">{title}</h1>
          <button
            onClick={toggleMute}
            title={muted ? "Unmute UI sounds" : "Mute UI sounds"}
            className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
