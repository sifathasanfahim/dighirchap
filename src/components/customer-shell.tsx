import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, ShoppingBag, Receipt, User2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function CustomerShell({ children }: { children: ReactNode }) {
  const count = useCart((s) => s.items.reduce((a, i) => a + i.qty, 0));
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
          <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground">
            Track order
          </Link>
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
