import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Plus, Minus, Flame, ShoppingBag, X } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { smartScore } from "@/lib/smart-search";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Dighir Chap" },
      { name: "description", content: "Browse the full Dighir Chap menu — chap, biryani, kebab and more." },
    ],
  }),
  component: MenuPage,
});

type Category = { id: string; name: string; image_url: string | null };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_top_pick?: boolean | null;
};

function MenuPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const categories = useQuery({
    queryKey: ["menu-cats"],
    queryFn: async () =>
      ((await supabase
        .from("categories")
        .select("id, name, image_url")
        .eq("active", true)
        .order("sort_order")).data ?? []) as Category[],
  });

  const items = useQuery({
    queryKey: ["menu-items-all"],
    queryFn: async () =>
      ((await supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, category_id, is_top_pick")
        .eq("available", true)
        .order("name")).data ?? []) as Item[],
  });

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = (items.data ?? []).filter((i) => activeCat === "all" || i.category_id === activeCat);
    if (!q) return list;
    const scored = list
      .map((i) => ({ i, s: smartScore(q, i.name, i.description) }))
      .filter((x) => x.s >= 0.5)
      .sort((a, b) => b.s - a.s);
    return scored.map((x) => x.i);
  }, [items.data, query, activeCat]);

  const cats = categories.data ?? [];
  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items.data ?? []) {
      const k = i.category_id ?? "uncat";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [items.data]);

  const cartCount = useCart((s) => s.items.reduce((a, c) => a + c.qty, 0));
  const cartTotal = useCart((s) => s.items.reduce((a, c) => a + c.qty * c.price, 0));

  return (
    <CustomerShell>
      {/* Editorial header */}
      <section className="relative pt-4 pb-6">
        <div className="text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            The Kitchen Collective
          </span>
          <h1 className="mt-2 font-serif text-4xl font-light italic leading-none md:text-6xl">
            Today&apos;s <span className="not-italic font-normal">Menu</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Smoky chap, slow-cooked biryani, fire-kissed kebab — every dish, one tap away.
          </p>
        </div>

        {/* Search */}
        <div className="relative mx-auto mt-6 max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes…"
            className="w-full rounded-full border bg-card py-3 pl-11 pr-9 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </section>

      {/* Floating glass category bar */}
      <div className="sticky top-14 z-20 -mx-4 px-4 py-3">
        <div className="mx-auto flex max-w-fit gap-1 rounded-full border border-border/60 bg-background/80 p-1.5 shadow-xl shadow-foreground/5 backdrop-blur-md overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CatPill
            label="All"
            count={items.data?.length ?? 0}
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
          />
          {cats.map((c) => {
            const n = countByCat.get(c.id) ?? 0;
            if (!n) return null;
            return (
              <CatPill
                key={c.id}
                label={c.name}
                count={n}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-8 pb-32">
        {items.isLoading ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No dishes match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
            {filtered.map((item) => <DishCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
          <Link
            to="/checkout"
            className="group flex items-center gap-4 rounded-full bg-foreground px-6 py-3.5 text-background shadow-2xl shadow-foreground/30 transition-all hover:scale-[1.02]"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm font-medium tracking-wide">View Your Order</span>
            <span className="h-4 w-px bg-background/30" />
            <span className="text-sm font-semibold">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
            <span className="rounded bg-background/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest">
              {fmtBDT(cartTotal)}
            </span>
          </Link>
        </div>
      )}
    </CustomerShell>
  );
}

function CatPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("ml-1.5 text-[10px]", active ? "opacity-70" : "opacity-50")}>{count}</span>
    </button>
  );
}

function DishCard({ item }: { item: Item }) {
  const inCart = useCart((s) => s.items.find((c) => c.id === item.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);

  return (
    <article className="group cursor-pointer">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted mb-4">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-6xl">🍗</div>
        )}

        {item.is_top_pick && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
            <Flame className="h-3 w-3 text-primary" /> Top
          </span>
        )}

        {/* Add control overlay */}
        <div className="absolute top-3 right-3">
          {inCart ? (
            <div className="flex items-center gap-1 rounded-full bg-foreground p-1 text-background shadow-lg">
              <button
                onClick={(e) => { e.stopPropagation(); sfx.tap(); setQty(item.id, inCart.qty - 1); }}
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-background/10"
                aria-label="Decrease"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[1ch] text-center text-xs font-bold">{inCart.qty}</span>
              <button
                onClick={(e) => { e.stopPropagation(); sfx.tap(); setQty(item.id, inCart.qty + 1); }}
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-background/10"
                aria-label="Increase"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                add({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url });
                sfx.success();
                toast.success(`${item.name} added`);
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-background/95 text-foreground shadow-lg backdrop-blur transition-all hover:bg-foreground hover:text-background hover:scale-110"
              aria-label={`Add ${item.name}`}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-base font-medium tracking-tight">{item.name}</h3>
          <span className="shrink-0 text-sm font-light text-muted-foreground">{fmtBDT(Number(item.price))}</span>
        </div>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
        )}
      </div>
    </article>
  );
}
