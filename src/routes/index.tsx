import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Heart, Clock, Star } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
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
      // Top picks filter only when no category selected and not showing all
      if (!showAll && !activeCat) q = q.eq("is_top_pick", true);
      if (activeCat) q = q.eq("category_id", activeCat);
      q = q.order("created_at", { ascending: false }).limit(showAll || activeCat ? 100 : 20);
      return (await q).data ?? [];
    },
  });

  // Auto-slide banner
  const [slide, setSlide] = useState(0);
  const slides = banners.data ?? [];
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <CustomerShell>
      {/* Hero slider */}
      <section className="relative">
        {slides.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${slide * 100}%)` }}
              >
                {slides.map((b) => {
                  const inner = (
                    <div className="relative h-44 w-full overflow-hidden bg-primary md:h-56">
                      <img
                        src={b.image_url}
                        alt={b.title ?? ""}
                        className="h-full w-full object-cover"
                      />
                      {(b.title || b.subtitle) && (
                        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-5 text-white">
                          {b.subtitle && (
                            <p className="text-xs opacity-90 md:text-sm">{b.subtitle}</p>
                          )}
                          {b.title && (
                            <h2 className="text-xl font-bold leading-tight md:text-2xl">
                              {b.title}
                            </h2>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <div key={b.id} className="w-full shrink-0">
                      {b.link_url ? (
                        <a href={b.link_url}>{inner}</a>
                      ) : (
                        inner
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {slides.length > 1 && (
              <div className="mt-3 flex justify-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === slide ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-orange-500 p-8 text-primary-foreground shadow-lg">
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">দীঘির চাপ</h1>
            <p className="mt-2 text-sm opacity-90">
              আমরা কইনা আমরা সেরা, খাইয়া দেহেন কেডা সেরা?
            </p>
            <Link
              to="/menu"
              className="mt-4 inline-block rounded-full bg-yellow-300 px-5 py-2 text-sm font-bold text-black"
            >
              Order Now
            </Link>
          </div>
        )}
      </section>

      {/* Category strip */}
      <section className="mt-6">
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-4 pb-1">
            <CategoryPill
              label="All"
              active={activeCat === null}
              onClick={() => setActiveCat(null)}
            />
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

      {/* Top picks */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{activeCat ? (categories.data?.find((c) => c.id === activeCat)?.name ?? "Category") : showAll ? "Full menu" : "Top picks"}</h2>
          <Link
            to="/menu"
            className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-black"
          >
            See all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(items.data ?? []).map((m) => (
            <Link
              key={m.id}
              to="/menu"
              className="block overflow-hidden rounded-2xl border bg-card shadow-sm"
            >
              <div className="relative h-44 bg-muted">
                {m.image_url ? (
                  <img
                    src={m.image_url}
                    alt={m.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-3xl">🍗</div>
                )}
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/95 text-primary shadow">
                  <Heart className="h-3.5 w-3.5" />
                </span>
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-1 text-[11px] font-medium shadow">
                  <Clock className="h-3 w-3" /> 25 min
                </span>
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-bold">{m.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> 4.8
                  </span>
                  <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background">
                    {fmtBDT(Number(m.price))}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {items.data && items.data.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {showAll ? "No items in this category yet." : "No top picks selected yet. Tap “See more” to browse the full menu."}
            </div>
          ) : null}
        </div>

        {!showAll && (
          <div className="mt-6 flex justify-center">
            <Link
              to="/menu"
              className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background shadow"
            >
              See more
            </Link>
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
    <button
      onClick={onClick}
      className="flex w-16 shrink-0 flex-col items-center gap-1.5"
    >
      <div
        className={cn(
          "grid h-16 w-16 place-items-center overflow-hidden rounded-2xl transition-all",
          active ? "bg-primary ring-2 ring-primary ring-offset-2" : "bg-foreground",
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
          active ? "text-primary" : "text-foreground",
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
