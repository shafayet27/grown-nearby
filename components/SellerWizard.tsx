"use client";

import { useActionState, useRef, useState } from "react";
import { createShop, type ShopState } from "@/app/sell/actions";

const field =
  "w-full rounded-xl border-2 border-green-200 bg-white px-4 py-3 text-base focus:border-green-600 focus:outline-none";
const label = "mb-1 block font-semibold";
const box = "rounded-2xl border border-green-100 p-4";
const primary = "w-full rounded-full bg-green-700 px-8 py-3.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto";
const ghost = "w-full rounded-full border-2 border-green-700 px-8 py-3 font-semibold text-green-700 hover:bg-green-50 sm:w-auto";

const TITLES = [
  "Name your shop",
  "Where will you sell from?",
  "How will buyers get their food?",
  "Review and open your shop",
];

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");
const BIRMINGHAM = /^B[0-9]{1,2}[A-Z]?[0-9][A-Z]{2}$/;

export default function SellerWizard() {
  const [state, formAction, pending] = useActionState<ShopState, FormData>(createShop, {});
  const formRef = useRef<HTMLFormElement>(null);

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [collection, setCollection] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [courier, setCourier] = useState(false);

  const [review, setReview] = useState<[string, string][]>([]);

  function validate(s: number): string {
    const fd = new FormData(formRef.current!);
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    if (s === 0) {
      const n = str("name");
      if (n.length < 3 || n.length > 60) return "Your shop name needs to be 3 to 60 characters.";
      if (str("description").length > 500) return "Please keep the description under 500 characters.";
    }
    if (s === 1) {
      if (!BIRMINGHAM.test(norm(str("postcode")))) return "Please enter a Birmingham postcode, for example B14 7AA.";
      if (str("address_line1").length < 3) return "Please enter your house number and street.";
    }
    if (s === 2) {
      if (!collection && !delivery && !courier) return "Choose at least one way for buyers to get your food.";
      const bad = (k: string) => {
        const f = parseFloat(str(k) || "0");
        return !(f >= 0 && f <= 50);
      };
      if (delivery && bad("delivery_fee")) return "Please enter a delivery fee between £0 and £50.";
      if (courier && bad("courier_fee")) return "Please enter a postage charge between £0 and £50.";
    }
    if (s === 3 && !fd.get("confirm_food")) return "Please confirm your food business registration.";
    return "";
  }

  function buildReview(): [string, string][] {
    const fd = new FormData(formRef.current!);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const money = (k: string) => `£${Number(s(k) || 0).toFixed(2)}`;
    const rows: [string, string][] = [["Shop name", s("name")]];
    if (s("description")) rows.push(["About", s("description")]);
    const pc = norm(s("postcode"));
    const pcPretty = `${pc.slice(0, -3)} ${pc.slice(-3)}`;
    const addr = [s("address_line1"), s("address_line2"), "Birmingham"].filter(Boolean).join(", ");
    rows.push(["Public area", `Birmingham ${pcPretty.split(" ")[0]}`]);
    rows.push(["Private address", `${addr}, ${pcPretty}`]);
    if (fd.get("collection")) rows.push(["Collection", s("collection_notes") || "Free"]);
    if (fd.get("delivery")) {
      rows.push(["Delivered by you", `${money("delivery_fee")}${s("delivery_notes") ? ` · ${s("delivery_notes")}` : ""}`]);
    }
    if (fd.get("courier")) {
      rows.push([`Courier (${s("courier_provider") === "dpd" ? "DPD" : "Evri"})`, `${money("courier_fee")} postage, items that keep only`]);
    }
    return rows;
  }

  function next() {
    const msg = validate(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    if (step === 2) setReview(buildReview());
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  }

  function back() {
    setError("");
    setStep(step - 1);
    window.scrollTo({ top: 0 });
  }

  const shown = error || (step === 3 ? state.error ?? "" : "");

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={(e) => {
        const msg = validate(3);
        if (msg) {
          e.preventDefault();
          setError(msg);
        }
      }}
      onKeyDown={(e) => {
        // Enter moves to the next step instead of submitting early
        if (e.key === "Enter" && step < 3 && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          next();
        }
      }}
    >
      <div className="mb-6">
        <p className="text-sm font-semibold text-green-700">Step {step + 2} of 5</p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step + 1 ? "bg-green-700" : "bg-green-100"}`} />
          ))}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-green-900">{TITLES[step]}</h1>
      </div>

      {/* Step 2 of 5: name your shop */}
      <div className={step === 0 ? "space-y-4" : "hidden"}>
        <p className="text-green-900/80">Choose a name buyers will remember. You can describe what you grow or make too.</p>
        <div>
          <label htmlFor="name" className={label}>Shop name</label>
          <input id="name" name="name" maxLength={60} className={field} placeholder="e.g. Hill Top Hens" />
        </div>
        <div>
          <label htmlFor="description" className={label}>About your shop (optional)</label>
          <textarea id="description" name="description" rows={4} maxLength={500} className={field} placeholder="What do you grow or make?" />
        </div>
      </div>

      {/* Step 3 of 5: location */}
      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <p className="text-green-900/80">
          Your full address stays private. Buyers only see the general area, for example B14.
        </p>
        <div>
          <label htmlFor="address_line1" className={label}>Address line 1</label>
          <input id="address_line1" name="address_line1" maxLength={100} autoComplete="address-line1" className={field} placeholder="House number and street" />
        </div>
        <div>
          <label htmlFor="address_line2" className={label}>Address line 2 (optional)</label>
          <input id="address_line2" name="address_line2" maxLength={100} autoComplete="address-line2" className={field} placeholder="Flat, building or area" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className={label}>Town or city</label>
            <input id="city" value="Birmingham" readOnly className={`${field} bg-green-50`} />
          </div>
          <div>
            <label htmlFor="postcode" className={label}>Postcode</label>
            <input id="postcode" name="postcode" autoComplete="postal-code" className={field} placeholder="B14 7AA" />
          </div>
        </div>
      </div>

      {/* Step 4 of 5: delivery */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <p className="text-green-900/80">Choose all that apply. Buyers will see only the options you offer.</p>

        <div className={box}>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" name="collection" checked={collection} onChange={(e) => setCollection(e.target.checked)} className="h-5 w-5 accent-green-700" />
            Collection from me
          </label>
          {collection && (
            <div className="mt-3">
              <label htmlFor="collection_notes" className={label}>Days and times (optional)</label>
              <input id="collection_notes" name="collection_notes" maxLength={200} className={field} placeholder="e.g. Saturdays 10am to 2pm" />
            </div>
          )}
        </div>

        <div className={box}>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" name="delivery" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="h-5 w-5 accent-green-700" />
            I deliver it myself
          </label>
          {delivery && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <div>
                <label htmlFor="delivery_fee" className={label}>Fee (£)</label>
                <input id="delivery_fee" name="delivery_fee" type="number" min="0" max="50" step="0.01" defaultValue="0" inputMode="decimal" className={field} />
              </div>
              <div>
                <label htmlFor="delivery_notes" className={label}>Area and days (optional)</label>
                <input id="delivery_notes" name="delivery_notes" maxLength={200} className={field} placeholder="e.g. Within 3 miles, Sundays" />
              </div>
            </div>
          )}
        </div>

        <div className={box}>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" name="courier" checked={courier} onChange={(e) => setCourier(e.target.checked)} className="h-5 w-5 accent-green-700" />
            I post it by courier (Evri or DPD)
          </label>
          <p className="mt-1 text-sm text-green-900/70">
            Courier is only offered on items that keep without refrigeration, like honey or jam. Fresh food is never offered by courier.
          </p>
          {courier && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="courier_provider" className={label}>Courier</label>
                <select id="courier_provider" name="courier_provider" className={field} defaultValue="evri">
                  <option value="evri">Evri</option>
                  <option value="dpd">DPD</option>
                </select>
              </div>
              <div>
                <label htmlFor="courier_fee" className={label}>Postage (£)</label>
                <input id="courier_fee" name="courier_fee" type="number" min="0" max="50" step="0.01" defaultValue="3.95" inputMode="decimal" className={field} />
              </div>
              <div>
                <label htmlFor="courier_notes" className={label}>Note (optional)</label>
                <input id="courier_notes" name="courier_notes" maxLength={200} className={field} placeholder="e.g. Posted in 2 days" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 5 of 5: review */}
      <div className={step === 3 ? "space-y-5" : "hidden"}>
        <dl className="divide-y divide-green-100 rounded-2xl border border-green-100">
          {review.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr]">
              <dt className="font-semibold">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <label className="flex items-start gap-3 rounded-2xl bg-green-50 p-4">
          <input type="checkbox" name="confirm_food" className="mt-1 h-5 w-5 shrink-0 accent-green-700" />
          <span>
            I’m registered as a food business with my local council, or I’ll register at least 28 days before I start selling.
          </span>
        </label>
      </div>

      {shown && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{shown}</p>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <button type="button" onClick={back} className={ghost}>Back</button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button type="button" onClick={next} className={primary}>Continue</button>
        ) : (
          <button type="submit" disabled={pending} className={primary}>
            {pending ? "Opening your shop…" : "Open my shop"}
          </button>
        )}
      </div>
    </form>
  );
}
