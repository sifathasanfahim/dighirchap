import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, Flame, Sparkles } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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
    const q = query.trim().toLowerCase();
    return (items.data ?? []).filter(
      (i) => !q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q),
    );
  }, [items.data, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of filtered) {
      const key = i.category_id ?? "uncat";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [filtered]);

  const cats = categories.data ?? [];
  const visibleCats = cats.filter((c) => grouped.has(c.id));
  const hasUncat = grouped.has("uncat");

  const scrollTo = (id: string) => {
    setActiveCat(id);
    const el = sectionRefs.current[id];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 132;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // Scroll-spy
  useEffect(() => {
    const ids = [...visibleCats.map((c) => c.id), ...(hasUncat ? ["uncat"] : [])];
    if (!ids.length) return;
    const onScroll = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = sectionRefs.current[id];
        if (!el) continue;
        if (el.getBoundingClientRect().top - 140 <= 0) current = id;
      }
      setActiveCat((prev) => (prev === current ? prev : current));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleCats.length, hasUncat]);

  return (
    <CustomerShell>
      {/* Editorial hero */}
      <section className="relative -mx-4 overflow-hidden bg-foreground px-4 pb-8 pt-6 text-background">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-yellow-300/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-background/70">
            <Sparkles className="h-3 w-3" /> The full menu
          </div>
          <h1 className="mt-3 text-3xl font-black leading-[1.05] md:text-5xl">
            Pick your <span className="italic text-primary">cravings</span>,
            <br /> we&apos;ll do the rest.
          </h1>
          <p className="mt-2 max-w-md text-sm text-background/70">
            Smoky chap, slow-cooked biryani, fire-kissed kebab — every dish, one tap away.
          </p>

          {/* Search */}
          <div className="relative mt-5 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chap, biryani, drinks…"
              className="w-full rounded-full border border-background/10 bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/50 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* Sticky category rail */}
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 backdrop-blur">
        <div ref={scrollerRef} className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CatChip label="All" active={activeCat === "all"} onClick={() => { setActiveCat("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          {visibleCats.map((c) => (
            <CatChip
              key={c.id}
              label={c.name}
              active={activeCat === c.id}
              onClick={() => scrollTo(c.id)}
            />
          ))}
          {hasUncat && (
            <CatChip label="More" active={activeCat === "uncat"} onClick={() => scrollTo("uncat")} />
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="mt-6 space-y-10">
        {items.isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}

        {visibleCats.map((c) => (
          <CategorySection
            key={c.id}
            ref={(el) => { sectionRefs.current[c.id] = el; }}
            title={c.name}
            items={grouped.get(c.id) ?? []}
          />
        ))}
        {hasUncat && (
          <CategorySection
            ref={(el) => { sectionRefs.current["uncat"] = el; }}
            title="More dishes"
            items={grouped.get("uncat") ?? []}
          />
        )}

        {!items.isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No dishes match &ldquo;{query}&rdquo;.
          </div>
        )}
      </div>
    </CustomerShell>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
        active
          ? "border-foreground bg-foreground text-background shadow-md"
          : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

const CategorySection = forwardRef<HTMLElement, { title: string; items: Item[] }>(
  function CategorySection({ title, items }, ref) {
    if (!items.length) return null;
    return (
      <section ref={ref} className="scroll-mt-32">
        <div className="mb-3 flex items-end justify-between border-b pb-2">
          <h2 className="text-xl font-black tracking-tight md:text-2xl">{title}</h2>
          <span className="text-xs text-muted-foreground">{items.length} dishes</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((i) => <DishRow key={i.id} item={i} />)}
        </div>
      </section>
    );
  },
);

function DishRow({ item }: { item: Item }) {
  const inCart = useCart((s) => s.items.find((c) => c.id === item.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);

  return (
    <article className="group relative flex gap-3 rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-3xl">🍗</div>
        )}
        {item.is_top_pick && (
          <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
            <Flame className="h-2.5 w-2.5" /> Top
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-sm font-bold">{item.name}</h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-black text-primary">{fmtBDT(Number(item.price))}</span>
          {inCart ? (
            <div className="flex items-center gap-1.5 rounded-full bg-foreground p-0.5 text-background">
              <button
                onClick={() => { sfx.tap(); setQty(item.id, inCart.qty - 1); }}
                className="grid h-6 w-6 place-items-center rounded-full hover:bg-background/10"
                aria-label="Decrease"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[1ch] text-center text-xs font-bold">{inCart.qty}</span>
              <button
                onClick={() => { sfx.tap(); setQty(item.id, inCart.qty + 1); }}
                className="grid h-6 w-6 place-items-center rounded-full hover:bg-background/10"
                aria-label="Increase"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                add({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url });
                sfx.success();
                toast.success(`${item.name} added`);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background shadow hover:bg-primary"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
