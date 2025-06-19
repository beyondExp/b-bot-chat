import { loadStripe } from "@stripe/stripe-js"

// Initialize Stripe with your publishable key
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

// Function to format price in cents to dollars
export const formatPrice = (price: number): string => {
  return `$${(price / 100).toFixed(2)}`
}

// Function to calculate token cost
export const BBOT_TOKEN_RATE = 0.0000001; // 1 B-Bot Token = $0.0000001

export function calculateTokenCost(tokens: number): number {
  return tokens * BBOT_TOKEN_RATE;
}

// Function to format token count
export const formatTokenCount = (count: number): string => {
  if (count < 1000) {
    return count.toString()
  } else if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}K`
  } else {
    return `${(count / 1000000).toFixed(1)}M`
  }
}
