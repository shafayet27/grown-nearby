"use client";

import { deleteListing, setListingActive } from "@/app/dashboard/listings/actions";

export default function ListingActions({
  id,
  active,
  canToggle,
}: {
  id: string;
  active: boolean;
  canToggle: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {canToggle && (
        <form action={setListingActive}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={active ? "0" : "1"} />
          <button className="w-full rounded-full border-2 border-green-700 px-6 py-3 font-semibold text-green-700 hover:bg-green-50 sm:w-auto">
            {active ? "Hide from my shop" : "Show in my shop"}
          </button>
        </form>
      )}
      <form
        action={deleteListing}
        onSubmit={(e) => {
          if (!confirm("Delete this listing and its photos? This can’t be undone.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button className="w-full rounded-full border-2 border-red-600 px-6 py-3 font-semibold text-red-700 hover:bg-red-50 sm:w-auto">
          Delete listing
        </button>
      </form>
    </div>
  );
}
