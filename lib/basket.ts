"use client";

import { useSyncExternalStore } from "react";

// The basket lives in the browser (so it works before signing in).
// It stores only listing ids and quantities. Prices are always looked up on the server.
export type BasketItem = { id: string; qty: number };

const KEY = "gn-basket-v1";
const EVENT = "gn-basket-change";
const MAX_QTY = 20;
const MAX_ITEMS = 50;

const EMPTY: BasketItem[] = [];
let cache: BasketItem[] = EMPTY;
let cacheRaw: string | null = null;

function valid(i: unknown): i is BasketItem {
  return (
    typeof i === "object" &&
    i !== null &&
    typeof (i as BasketItem).id === "string" &&
    Number.isInteger((i as BasketItem).qty) &&
    (i as BasketItem).qty >= 1
  );
}

function read(): BasketItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cacheRaw) return cache;
    cacheRaw = raw;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter(valid).slice(0, MAX_ITEMS) : EMPTY;
    return cache;
  } catch {
    return cache;
  }
}

function write(items: BasketItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage blocked: the basket simply won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useBasket(): BasketItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function basketCount(items: BasketItem[]) {
  return items.reduce((n, i) => n + i.qty, 0);
}

export function addToBasket(id: string, qty: number) {
  const items = read();
  const found = items.find((i) => i.id === id);
  const next = found
    ? items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i))
    : [...items, { id, qty: Math.min(MAX_QTY, qty) }];
  write(next.slice(0, MAX_ITEMS));
}

export function setQuantity(id: string, qty: number) {
  const q = Math.max(1, Math.min(MAX_QTY, qty));
  write(read().map((i) => (i.id === id ? { ...i, qty: q } : i)));
}

export function removeFromBasket(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearBasket() {
  write([]);
}
