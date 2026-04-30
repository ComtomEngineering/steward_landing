/**
 * Stripe Configuration
 * Contains all configuration needed for Stripe integration
 */

const StripeConfig = {
  // Stripe Publishable Key - REQUIRED
  // Set this via environment variable or directly
  publishableKey:
    (typeof process !== "undefined" &&
      process.env &&
      process.env.STRIPE_PUBLISHABLE_KEY) ||
    "pk_test_51TPn8BCedfJbvsUYWmp560FZsoKAmr5T0aUXy2UJaO4883rATyB5zfOvtz7mKO8cyjD6vdtixHBI17zL8fbkX6pM00v9HXuHOG",

  // API Endpoints
  endpoints: {
    createPaymentIntent: "/api/create-payment-intent",
    completeSignup: "/api/complete-signup",
    validateCoupon: "/api/validate-coupon",
    retrieveSubscription: "/api/subscription",
  },

  // baseUrl: "http://localhost:8000",
  baseUrl: "http://api.steward.comtom.engineering",

  // Currency Configuration
  currency: "usd",
  locale: "en-US",

  // Product Plans
  plans: {
    weekly: {
      id: "weekly",
      name: "Weekly Digest",
      description:
        "Perfect for staying current with a weekly roundup of the most important AI developments.",
      features: [
        "One weekly briefing",
        "Top 20 stories summarized",
        "Topic filtering",
        "Mobile optimized",
      ],
      pricing: {
        monthly: {
          amount: 4.99,
          amountCents: 499,
          priceId: "price_weekly_monthly",
          interval: "month",
          intervalCount: 1,
        },
        yearly: {
          amount: 49.9,
          amountCents: 4990,
          priceId: "price_weekly_yearly",
          interval: "year",
          intervalCount: 1,
          discount: 0.17, // 17% savings
        },
      },
      popular: false,
      trialDays: 7,
    },
    daily: {
      id: "daily",
      name: "Daily Briefing",
      description:
        "Stay ahead with daily AI news curated specifically for your interests and schedule.",
      features: [
        "Daily briefings (5x/week)",
        "Unlimited story access",
        "Advanced AI filtering",
        "Priority support",
        "Archive access",
      ],
      pricing: {
        monthly: {
          amount: 7.99,
          amountCents: 799,
          priceId: "price_daily_monthly",
          interval: "month",
          intervalCount: 1,
        },
        yearly: {
          amount: 79.9,
          amountCents: 7990,
          priceId: "price_daily_yearly",
          interval: "year",
          intervalCount: 1,
          discount: 0.17, // 17% savings
        },
      },
      popular: true,
      trialDays: 7,
    },
  },

  // Stripe Elements Styling
  elementStyles: {
    base: {
      fontSize: "16px",
      color: "#424770",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a",
    },
  },

  // Validation Rules
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    minPasswordLength: 8,
  },

  // Feature Flags
  features: {
    applePay: true,
    googlePay: true,
    threeDSecure: true,
    saveCard: true,
  },

  // Error Messages
  errorMessages: {
    invalidEmail: "Please enter a valid email address",
    invalidCard: "Your card number is invalid",
    expiredCard: "Your card has expired",
    cardDeclined: "Your card was declined. Please try another payment method.",
    networkError: "Network error. Please check your connection and try again.",
    unknownError: "An unexpected error occurred. Please try again.",
    paymentFailed: "Payment processing failed. Please try again.",
    signupFailed: "Unable to complete signup. Please try again.",
  },

  // Success Messages
  successMessages: {
    paymentProcessing: "Processing your payment...",
    signupComplete: "Welcome! Your subscription is active.",
    confirmationSent: "Confirmation email sent to your inbox.",
  },

  // Retry Configuration
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },

  // Timeouts (in milliseconds)
  timeouts: {
    paymentIntent: 30000,
    cardConfirmation: 30000,
    signup: 15000,
  },

  // Logging
  logging: {
    enabled: process.env.NODE_ENV !== "production",
    level: process.env.LOG_LEVEL || "info",
  },

  // Development/Testing
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTesting: process.env.NODE_ENV === "test",
};

// Validate configuration
function validateConfig() {
  if (
    !StripeConfig.publishableKey ||
    StripeConfig.publishableKey === "pk_test_YOUR_KEY_HERE"
  ) {
    console.warn(
      "⚠️  Stripe publishable key not configured. Payments will not work.",
    );
  }

  return StripeConfig;
}

// Export configuration
if (typeof module !== "undefined" && module.exports) {
  module.exports = validateConfig();
} else if (typeof window !== "undefined") {
  window.StripeConfig = validateConfig();
}
