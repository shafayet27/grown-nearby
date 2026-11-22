import { NextResponse, type NextRequest } from "next/server";
import { finalizeSession } from "@/lib/payments";
import { verifyWebhook } from "@/lib/stripe";

// Stripe calls this when a payment completes, even if the buyer closed their browser first.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not set up." }, { status: 503 });

  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" && event.data?.object?.id) {
    try {
      await finalizeSession(event.data.object.id);
    } catch {
      return NextResponse.json({ error: "Could not process." }, { status: 500 }); // Stripe will retry
    }
  }
  return NextResponse.json({ received: true });
}
