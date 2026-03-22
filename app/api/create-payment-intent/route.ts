import { NextResponse } from "next/server"
import Stripe from "stripe"

function getStripe(): Stripe | null {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim()
  if (!key) return null
  return new Stripe(key, { apiVersion: "2023-10-16" })
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json({ error: "Payments are not configured" }, { status: 503 })
    }

    const { amount } = await req.json()

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
}
