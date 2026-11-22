"use client";

import { useEffect, useState } from "react";
import { useBasket } from "@/lib/basket";
import { loadBasket, type BasketRow } from "@/app/basket/actions";

// The basket's items plus their current details from the server
export function useBasketRows() {
  const items = useBasket();
  const idsKey = items.map((i) => i.id).join(",");
  const [loaded, setLoaded] = useState<{ key: string; rows: BasketRow[] } | null>(null);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    loadBasket(idsKey.split(",")).then((rows) => {
      if (!cancelled) setLoaded({ key: idsKey, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const ready = idsKey === "" || loaded?.key === idsKey;
  const rows = idsKey !== "" && loaded?.key === idsKey ? loaded.rows : [];
  return { items, rows, loading: !ready };
}
