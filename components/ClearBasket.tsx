"use client";

import { useEffect } from "react";
import { clearBasket } from "@/lib/basket";

// Empties the basket once an order has been paid for
export default function ClearBasket() {
  useEffect(() => {
    clearBasket();
  }, []);
  return null;
}
