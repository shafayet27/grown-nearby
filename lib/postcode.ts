const UK_POSTCODE = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;

// "b147aa" -> "B14 7AA", or null if it isn't shaped like a UK postcode
export function tidyPostcode(raw: string) {
  const pc = raw.toUpperCase().replace(/\s+/g, "");
  return UK_POSTCODE.test(pc) ? `${pc.slice(0, -3)} ${pc.slice(-3)}` : null;
}

// Free check with postcodes.io: does the postcode exist, and is it in Birmingham?
// If that service is down we carry on, because the database applies its own Birmingham check too.
export async function checkArea(pc: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^B[0-9]/.test(pc)) {
    return { ok: false, error: "Grown Nearby is only open in Birmingham for now. Please enter a Birmingham postcode." };
  }
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      return { ok: false, error: "We couldn’t find that postcode. Please check it and try again." };
    }
    if (res.ok) {
      const json = await res.json();
      const district: string | undefined = json?.result?.admin_district;
      if (district && district !== "Birmingham") {
        return { ok: false, error: `That postcode is in ${district}. Grown Nearby is only open in Birmingham for now.` };
      }
    }
  } catch {
    // service unavailable: fall through
  }
  return { ok: true };
}
