import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

const tone: Record<OrderStatus, string> = {
  requested: "bg-navy/10 text-navy",
  pickup_scheduled: "bg-blue/15 text-blue",
  picked_up: "bg-blue/15 text-blue",
  at_laundry: "bg-cyan/20 text-navy",
  washing: "bg-cyan/20 text-navy",
  ready: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  delivery_scheduled: "bg-blue/15 text-blue",
  out_for_delivery: "bg-blue/15 text-blue",
  delivered: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  completed: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  cancelled: "bg-[#C0392B]/12 text-[#C0392B]",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-display text-xs font-extrabold ${tone[status]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
