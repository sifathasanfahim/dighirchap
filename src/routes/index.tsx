import { createFileRoute } from "@tanstack/react-router";
import { CustomerShell } from "@/components/customer-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dighir Chap — Order chap, biryani & kebab online" },
      { name: "description", content: "Order signature chap, biryani and kebab from Dighir Chap." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <CustomerShell>
      <section className="rounded-3xl bg-gradient-to-br from-primary to-orange-500 p-8 text-primary-foreground shadow-lg">
        <h1 className="text-2xl font-bold leading-tight md:text-3xl">দীঘির চাপ</h1>
        <p className="mt-2 text-sm opacity-90">
          আমরা কইনা আমরা সেরা, খাইয়া দেহেন কেডা সেরা?
        </p>
      </section>

      <div className="mt-10 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Customer menu view coming soon.
      </div>
    </CustomerShell>
  );
}
