export const UNITS = [
  "each",
  "per dozen",
  "per kg",
  "per 500g",
  "per box",
  "per bunch",
  "per jar",
  "per loaf",
  "per litre",
];

// The 14 main allergens that UK food businesses must declare
export const ALLERGENS = [
  "Celery",
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Lupin",
  "Milk",
  "Molluscs",
  "Mustard",
  "Peanuts",
  "Sesame",
  "Soybeans",
  "Sulphur dioxide and sulphites",
  "Tree nuts",
];

export const NO_ALLERGENS_TEXT = "None of the 14 main allergens";

export function buildAllergenText(selected: string[], none: boolean, notes: string) {
  const base = none ? NO_ALLERGENS_TEXT : `Contains: ${selected.join(", ")}`;
  return notes ? `${base} · ${notes}` : base;
}

export function parseAllergenText(text: string | null) {
  if (!text) return { none: false, selected: [] as string[], notes: "" };
  const [main, ...rest] = text.split(" · ");
  const notes = rest.join(" · ");
  if (main === NO_ALLERGENS_TEXT) return { none: true, selected: [] as string[], notes };
  if (main.startsWith("Contains: ")) {
    const selected = main.slice("Contains: ".length).split(", ").filter((a) => ALLERGENS.includes(a));
    return { none: false, selected, notes };
  }
  // Older free-text entries are kept as notes
  return { none: false, selected: [] as string[], notes: text };
}

// Label and colour for a listing's state, as the seller sees it
export function statusChip(l: { status: string; active: boolean }) {
  if (l.status === "pending") return { text: "Waiting for approval", cls: "bg-amber-100 text-amber-900" };
  if (l.status === "rejected") return { text: "Not approved", cls: "bg-red-100 text-red-800" };
  if (!l.active) return { text: "Hidden", cls: "bg-gray-100 text-gray-700" };
  return { text: "Live", cls: "bg-green-100 text-green-800" };
}
