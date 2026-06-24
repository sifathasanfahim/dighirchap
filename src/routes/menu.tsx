import { createFileRoute } from "@tanstack/react-router";
import { CustomerShell } from "@/components/customer-shell";

export const Route = createFileRoute("/menu")({
  head: () => ({ meta: [{ title: "Menu — Dighir Chap" }] }),
  component: MenuPage,
});

function MenuPage() {
  return (
    <CustomerShell>
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Menu page is being redesigned. Please check back soon.
      </div>
    </CustomerShell>
  );
}
