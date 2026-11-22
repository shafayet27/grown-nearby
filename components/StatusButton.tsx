"use client";

import { setOrderStatus } from "@/app/orders/actions";

const styles = {
  primary: "bg-green-700 text-white hover:bg-green-800",
  danger: "border-2 border-red-600 text-red-700 hover:bg-red-50",
} as const;

export default function StatusButton({
  id,
  status,
  label,
  variant = "primary",
  confirmText,
}: {
  id: string;
  status: string;
  label: string;
  variant?: keyof typeof styles;
  confirmText?: string;
}) {
  return (
    <form
      action={setOrderStatus}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`w-full rounded-full px-6 py-2.5 font-semibold sm:w-auto ${styles[variant]}`}>{label}</button>
    </form>
  );
}
