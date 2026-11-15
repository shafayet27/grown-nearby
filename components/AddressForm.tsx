"use client";

import { useActionState } from "react";
import { updateAddress, type AddressState } from "@/app/sell/actions";

const field =
  "w-full rounded-xl border-2 border-green-200 bg-white px-4 py-3 text-base focus:border-green-600 focus:outline-none";

export default function AddressForm({
  defaultAddress,
  defaultPostcode,
}: {
  defaultAddress: string;
  defaultPostcode: string;
}) {
  const [state, formAction, pending] = useActionState<AddressState, FormData>(updateAddress, {});

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <label htmlFor="address" className="mb-1 block font-semibold">Address</label>
        <input
          id="address"
          name="address"
          defaultValue={defaultAddress}
          required
          minLength={5}
          maxLength={200}
          autoComplete="street-address"
          className={field}
          placeholder="House number and street"
        />
        <p className="mt-1 text-sm text-green-900/70">We add “Birmingham” for you.</p>
      </div>
      <div className="sm:max-w-xs">
        <label htmlFor="postcode" className="mb-1 block font-semibold">Postcode</label>
        <input
          id="postcode"
          name="postcode"
          defaultValue={defaultPostcode}
          required
          autoComplete="postal-code"
          className={field}
          placeholder="B14 7AA"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      )}
      {state.message && (
        <p role="status" className="rounded-xl bg-green-100 p-3 text-sm text-green-900">{state.message}</p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}
