import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Star, Flame } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { PopupBanner } from "@/components/popup-banner";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dighir Chap — Order chap, biryani & kebab online" },
      { name: "description", content: "Order signature chap, biryani and kebab from Dighir Chap." },
    ],
  }),
  component: HomePage,
});

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
};

const CARD_COLORS = [
  { bg: "bg-fuchsia-600", text: "text-white", sub: "text-white/80" },
  { bg: "bg-amber-400", text: "text-slate-900", sub: "text-slate-900/70" },
  { bg: "bg-rose-500", text: "text-white", sub: "text-white/80" },
  { bg: "bg-emerald-500", text: "text-white", sub: "text-white/80" },
];

function HomePage() {
  const banners = useQuery({
    queryKey: ["home-banners"],
    queryFn: async () =>
      ((await (supabase as any)
        .from("promo_banners")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })).data ?? []) as Banner[],
  });

  const categories = useQuery({
    queryKey: ["home-categories"],
    queryFn: async () =>
      (await supabase
        .from("categories")
        .select("id, name, image_url, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })).data ?? [],
  });

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const items = useQuery({
    queryKey: ["home-items", activeCat, showAll],
    queryFn: async () => {
      let q = supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, category_id, is_top_pick")
        .eq("available", true);
      if (!showAll && !activeCat) q = q.eq("is_top_pick", true);
      if (activeCat) q = q.eq("category_id", activeCat);
      q = q.order("created_at", { ascending: false }).limit(showAll || activeCat ? 100 : 20);
      return (await q).data ?? [];
    },
  });

  const [slide, setSlide] = useState(0);
  const slides = banners.data ?? [];
  const mainSlides = slides.slice(0, Math.max(1, slides.length - 2));
  const sideSlides = slides.slice(slides.length > 2 ? slides.length - 2 : 0, slides.length);

  useEffect(() => {
    if (mainSlides.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % mainSlides.length), 4500);
    return () => clearInterval(t);
  }, [mainSlides.length]);

  const featuredCats = (categories.data ?? []).slice(0, 4);

  return (
    <CustomerShell>
      <PopupBanner />

      {/* 1 + 2 Hero */}
      <section className="grid grid-cols-3 gap-3">
        <div className="col-span-2 overflow-hidden rounded-3xl">
          {mainSlides.length > 0 ? (
            <div
              className="flex h-44 transition-transform duration-500 ease-out md:h-56"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {mainSlides.map((b) => {
                const inner = (
                  <div className="relative h-full w-full overflow-hidden bg-amber-400">
                    <img src={b.image_url} alt={b.title ?? ""} className="h-full w-full object-cover" />
                    {(b.title || b.subtitle) && (
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 text-white">
                        {b.subtitle && <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">{b.subtitle}</p>}
                        {b.title && <h2 className="text-xl font-black leading-tight md:text-2xl">{b.title}</h2>}
                      </div>
                    )}
                  </div>
                );
                return (
                  <div key={b.id} className="h-full w-full shrink-0">
                    {b.link_url ? <a href={b.link_url} className="block h-full">{inner}</a> : inner}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative flex h-44 flex-col justify-center overflow-hidden rounded-3xl bg-amber-400 p-5 md:h-56">
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Best in town</span>
              <h1 className="mt-1 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                FRESH, BOLD<br />& TASTY
              </h1>
              <p className="mt-1 text-xs text-slate-800">দীঘির চাপ — খাইয়া দেহেন কেডা সেরা?</p>
              <Link to="/menu" className="mt-3 inline-block w-fit rounded-full bg-rose-600 px-5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                Shop now
              </Link>
            </div>
          )}
          {mainSlides.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {mainSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={cn("h-1.5 rounded-full transition-all", i === slide ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30")}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {(sideSlides.length ? sideSlides : [null, null]).slice(0, 2).map((b, i) => {
            const fallbackBg = i === 0 ? "bg-slate-900" : "bg-rose-500";
            if (!b) {
              return (
                <Link
                  key={i}
                  to="/menu"
                  className={cn(
                    "relative grid h-[5.25rem] place-items-center overflow-hidden rounded-2xl p-3 text-white md:h-[6.75rem]",
                    fallbackBg,
                  )}
                >
                  <span className="text-center text-[11px] font-black uppercase tracking-wider">
                    {i === 0 ? "New combo" : "Hot deal"}
                  </span>
                </Link>
              );
            }
            const inner = (
              <div className="relative h-full w-full overflow-hidden">
                <img src={b.image_url} alt={b.title ?? ""} className="h-full w-full object-cover" />
                {(b.title || b.subtitle) && (
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
                    {b.title && <p className="text-[11px] font-black leading-tight">{b.title}</p>}
                    {b.subtitle && <p className="text-[9px] opacity-90">{b.subtitle}</p>}
                  </div>
                )}
              </div>
            );
            return (
              <div key={b.id} className={cn("h-[5.25rem] overflow-hidden rounded-2xl md:h-[6.75rem]", fallbackBg)}>
                {b.link_url ? <a href={b.link_url} className="block h-full">{inner}</a> : inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* Category strip */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Browse categories</h3>
          <button
            onClick={() => { setActiveCat(null); setShowAll(false); }}
            className="text-[11px] font-bold text-rose-600"
          >
            Reset
          </button>
        </div>
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-3 pb-1">
            <CategoryPill label="All" active={activeCat === null} onClick={() => setActiveCat(null)} />
            {(categories.data ?? []).map((c) => (
              <CategoryPill
                key={c.id}
                label={c.name}
                imageUrl={c.image_url}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Colorful featured category cards */}
      {featuredCats.length > 0 && (
        <section className="mt-6 grid grid-cols-2 gap-3">
          {featuredCats.map((c, i) => {
            const color = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <button
                key={c.id}
                onClick={() => { setActiveCat(c.id); setShowAll(true); }}
                className={cn(
                  "group relative flex aspect-square flex-col justify-between overflow-hidden rounded-[2rem] p-4 text-left shadow-md transition-transform hover:scale-[1.02]",
                  color.bg,
                )}
              >
                <p className={cn("z-10 text-sm font-black leading-tight", color.text)}>{c.name}</p>
                <span className={cn("z-10 text-[10px] font-bold uppercase tracking-wider", color.sub)}>
                  Order now →
                </span>
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="absolute -bottom-3 -right-3 h-24 w-24 rotate-6 object-cover transition-transform group-hover:rotate-12"
                  />
                ) : (
                  <span className="absolute -bottom-2 -right-2 text-7xl opacity-60">🍽️</span>
                )}
              </button>
            );
          })}
        </section>
      )}

      {/* Top picks / category items */}
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-rose-600" />
            <div>
              <h2 className="text-base font-black tracking-tight">
                {activeCat
                  ? (categories.data?.find((c) => c.id === activeCat)?.name ?? "Category")
                  : showAll ? "Full menu" : "Top picks"}
              </h2>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Hand-picked for you
              </p>
            </div>
          </div>
          <Link to="/menu" className="text-[11px] font-bold uppercase tracking-widest text-rose-600">
            See all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(items.data ?? []).map((m) => (
            <Link
              key={m.id}
              to="/menu"
              className="group block overflow-hidden rounded-3xl border border-border/60 bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative mb-2 h-28 overflow-hidden rounded-2xl bg-muted">
                {m.image_url ? (
                  <img
                    src={m.image_url}
                    alt={m.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-4xl">🍗</div>
                )}
                {m.is_top_pick && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                    <Flame className="h-2.5 w-2.5" /> Hot
                  </span>
                )}
                <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-lg bg-background/95 px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur">
                  4.8 <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                </span>
              </div>
              <p className="line-clamp-1 text-xs font-bold text-foreground">{m.name}</p>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-sm font-black tabular-nums">{fmtBDT(Number(m.price))}</span>
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-foreground text-background shadow-md transition-transform group-hover:scale-110">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
          {items.data && items.data.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {showAll || activeCat
                ? "No items in this category yet."
                : 'No top picks selected yet. Tap "See more" to browse the full menu.'}
            </div>
          ) : null}
        </div>

        {!showAll && !activeCat && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowAll(true)}
              className="rounded-full bg-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-background shadow-lg"
            >
              See more
            </button>
          </div>
        )}
      </section>
    </CustomerShell>
  );
}

function CategoryPill({
  label,
  imageUrl,
  active,
  onClick,
}: {
  label: string;
  imageUrl?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
      <div
        className={cn(
          "grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-2 transition-all",
          active ? "border-rose-600 bg-rose-50 ring-2 ring-rose-200" : "border-transparent bg-muted",
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">{categoryEmoji(label)}</span>
        )}
      </div>
      <span
        className={cn(
          "max-w-full truncate text-[11px] font-semibold",
          active ? "text-rose-600" : "text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  const map: [RegExp, string][] = [
    [/burger|বার্গার/i, "🍔"],
    [/pizza|পিজ্জা/i, "🍕"],
    [/nacho|নাচোস/i, "🌮"],
    [/sandwich|স্যান্ডউইচ/i, "🥪"],
    [/corn ?dog|কর্ন/i, "🌭"],
    [/meat|মিট/i, "🥩"],
    [/shawarma|শর্মা/i, "🌯"],
    [/pasta|পাস্তা/i, "🍝"],
    [/noodle|নুডুলস/i, "🍜"],
    [/fry|ফ্রাই/i, "🍟"],
    [/family|ফ্যামিলি|combo|কম্বো|set|সেট/i, "🍱"],
    [/thali|থালি/i, "🍛"],
    [/masala|মাসালা/i, "🌶️"],
    [/kabab|kebab|কাবাব/i, "🍢"],
    [/chap|চাপ/i, "🍗"],
    [/naan|roti|নান|রুটি/i, "🫓"],
    [/faluda|ফালুদা|ice ?cream|আইসক্রিম/i, "🍨"],
    [/lemon|mojito|মজিতো|লেমনেড/i, "🍋"],
    [/lassi|লাচ্ছি|milk ?shake|মিল্ক/i, "🥛"],
    [/juice|জুস/i, "🧃"],
    [/hot ?coffee|হট কফি/i, "☕"],
    [/cold ?coffee|কোল্ড কফি/i, "🧋"],
    [/beverage|বেভারেজ|drink/i, "🥤"],
  ];
  for (const [re, emoji] of map) if (re.test(n)) return emoji;
  return "🍽️";
}
