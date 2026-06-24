import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtBDT } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dighir Chap — Order chap, biryani & kebab online" },
      { name: "description", content: "Order signature chap, biryani and kebab from Dighir Chap. Fast delivery, cash on delivery, loyalty coins on every order." },
      { property: "og:title", content: "Dighir Chap" },
      { property: "og:description", content: "Signature Bangladeshi chap, biryani, kebab delivered hot." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const featured = useQuery({
    queryKey: ["featured-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("available", true)
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const add = useCart((s) => s.add);

  return (
    <CustomerShell>
      <section className="rounded-3xl bg-gradient-to-br from-primary to-orange-500 p-6 text-primary-foreground shadow-lg">
        <h1 className="text-2xl font-bold leading-tight md:text-3xl">Bangladesh-er Best Chap</h1>
        <p className="mt-1 text-sm opacity-90">Hot, fresh & delivered to your door.</p>
        <Link
          to="/menu"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary"
        >
          <Search className="h-4 w-4" /> Browse menu
        </Link>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Categories</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {categories.data?.map((c) => (
            <Link
              key={c.id}
              to="/menu"
              search={{ category: c.id }}
              className="rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:shadow-md"
            >
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-accent text-xl">
                🍽️
              </div>
              <div className="text-xs font-medium">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Featured</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.data?.map((item) => (
            <div key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 grid aspect-video place-items-center rounded-xl bg-accent text-4xl">🥘</div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-base font-bold text-primary">{fmtBDT(item.price)}</span>
                <Button
                  size="sm"
                  onClick={() => {
                    add({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url });
                    toast.success(`${item.name} added`);
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </CustomerShell>
  );
}
