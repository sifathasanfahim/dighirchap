import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, ShoppingBag, Receipt, User2, LifeBuoy, Coins } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ensureNotificationPermission, showBrowserNotification } from "@/lib/notifications";
import { sfx } from "@/lib/sounds";


export function CustomerShell({ children }: { children: ReactNode }) {
  const count = useCart((s) => s.items.reduce((a, i) => a + i.qty, 0));
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const coinsQ = useQuery({
    queryKey: ["my-coins-pill"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("coins").eq("id", u.user.id).maybeSingle();
      return data?.coins ?? 0;
    },
    staleTime: 30_000,
  });



  const tabs: { to: string; icon: typeof Home; label: string; badge?: number }[] = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/menu", icon: UtensilsCrossed, label: "Menu" },
    { to: "/cart", icon: ShoppingBag, label: "Cart", badge: count },
    { to: "/orders", icon: Receipt, label: "Orders" },
    { to: "/profile", icon: User2, label: "Account" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
              D
            </div>
            <span className="text-lg font-bold tracking-tight">Dighir Chap</span>
          </Link>
          <div className="flex items-center gap-3">
            {coinsQ.data !== null && coinsQ.data !== undefined && (
              <Link
                to="/profile"
                className="group flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-all hover:scale-105 hover:bg-primary/20"
                title="Your coins"
              >
                <Coins className="h-3.5 w-3.5 animate-pulse" />
                <span className="tabular-nums">{coinsQ.data}</span>
              </Link>
            )}
            <Link to="/complaints" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <LifeBuoy className="h-4 w-4" /> Help
            </Link>
            <Link to="/orders" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              Track order
            </Link>
          </div>

        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
                {t.badge ? (
                  <span className="absolute right-1/4 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {t.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
