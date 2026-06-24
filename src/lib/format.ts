export const fmtBDT = (n: number | string) => `৳${Number(n).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString("en-BD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready: "bg-purple-100 text-purple-800",
  picked_up: "bg-cyan-100 text-cyan-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};
