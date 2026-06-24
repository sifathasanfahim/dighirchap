import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { z } from "zod";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtBDT } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const search = z.object({ category: z.string().optional(), q: z.string().optional() });

export const Route = createFileRoute("/menu")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Menu — Dighir Chap" }, { name: "description", content: "Full Dighir Chap menu — chap, biryani, kebab, drinks, desserts." }] }),
  component: MenuPage,
});

function MenuPage() {
  const { category, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(q ?? "");

  const categories = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => (await supabase.from("categories").select("*").eq("active", true).order("sort_order")).data ?? [],
  });

  const items = useQuery({
    queryKey: ["menu-items", category, query],
    queryFn: async () => {
      let q = supabase.from("menu_items").select("*").eq("available", true);
      if (category) q = q.eq("category_id", category);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
  });

  const add = useCart((s) => s.add);

  return (
    <CustomerShell>
      <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 pb-3 pt-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              navigate({ search: { category, q: e.target.value || undefined } });
            }}
            placeholder="Search dishes..."
            className="pl-9"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => navigate({ search: { q: query || undefined } })}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", !category ? "bg-primary text-primary-foreground" : "bg-card")}
          >
            All
          </button>
          {categories.data?.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ search: { category: c.id, q: query || undefined } })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                category === c.id ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {items.data?.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-sm">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-accent text-2xl">🥘</div>
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="truncate font-semibold">{item.name}</h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="font-bold text-primary">{fmtBDT(item.price)}</span>
                <Button
                  size="sm"
                  onClick={() => {
                    add({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url });
                    toast.success("Added to cart");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        ))}
        {items.data?.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No items found.</div>}
      </div>
    </CustomerShell>
  );
}
