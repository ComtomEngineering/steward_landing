/**
 * Stripe Client Module
 * Handles all Stripe payment integration and checkout logic
 */

class StripeClient {
  constructor(publishableKey) {
    if (!publishableKey) {
      throw new Error("Stripe publishable key is required");
    }

    this.publishableKey = publishableKey;
    this.stripe = null;
    this.elements = null;
    this.cardElement = null;
    this.isInitialized = false;
    // this.baseUrl = "http://localhost:8000";
    this.baseUrl = "http://api.steward.comtom.engineering";

    // Pricing configuration
    this.products = {
      weekly: {
        name: "Weekly Digest",
        priceIds: {
          monthly: "price_weekly_monthly", // To be replaced with actual Stripe price ID
          yearly: "price_weekly_yearly", // To be replaced with actual Stripe price ID
        },
        prices: {
          monthly: 4.99,
          yearly: 49.9,
        },
        description:
          "Perfect for staying current with a weekly roundup of the most important AI developments.",
      },
      daily: {
        name: "Daily Briefing",
        priceIds: {
          monthly: "price_daily_monthly", // To be replaced with actual Stripe price ID
          yearly: "price_daily_yearly", // To be replaced with actual Stripe price ID
        },
        prices: {
          monthly: 7.99,
          yearly: 79.9,
        },
        description:
          "Stay ahead with daily AI news curated specifically for your interests and schedule.",
      },
    };

    this.currentBillingPeriod = "monthly";
    this.selectedPlan = null;
  }

  /**
   * Initialize Stripe and Elements
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async init() {
    try {
      // Load Stripe library dynamically if not already loaded
      if (!window.Stripe) {
        await this.loadStripeScript();
      }

      this.stripe = window.Stripe(this.publishableKey);
      if (!this.stripe) {
        throw new Error("Failed to initialize Stripe");
      }

      this.elements = this.stripe.elements();
      if (!this.elements) {
        throw new Error("Failed to create Stripe elements");
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("Stripe initialization failed:", error);
      throw error;
    }
  }

  /**
   * Load Stripe.js script dynamically
   * @returns {Promise<void>}
   */
  loadStripeScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Stripe.js"));
      document.head.appendChild(script);
    });
  }

  /**
   * Create and mount card element
   * @param {string} elementId - ID of the DOM element to mount card
   * @returns {boolean} - True if card element mounted successfully
   */
  mountCardElement(elementId) {
    if (!this.isInitialized) {
      throw new Error("Stripe client not initialized. Call init() first.");
    }

    try {
      const container = document.getElementById(elementId);
      if (!container) {
        throw new Error(`Element with id "${elementId}" not found`);
      }

      // Remove existing card element if present
      if (this.cardElement) {
        this.cardElement.unmount();
      }

      this.cardElement = this.elements.create("card", {
        style: {
          base: {
            fontSize: "16px",
            color: "#424770",
            "::placeholder": {
              color: "#aab7c4",
            },
          },
          invalid: {
            color: "#fa755a",
            iconColor: "#fa755a",
          },
        },
      });

      this.cardElement.mount(container);
      return true;
    } catch (error) {
      console.error("Failed to mount card element:", error);
      throw error;
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get price for selected plan and billing period
   * @param {string} plan - 'weekly' or 'daily'
   * @param {string} billingPeriod - 'monthly' or 'yearly'
   * @returns {number} - Price in cents (for Stripe)
   */
  getPrice(plan, billingPeriod) {
    if (!this.products[plan]) {
      throw new Error(`Unknown plan: ${plan}`);
    }

    if (!["monthly", "yearly"].includes(billingPeriod)) {
      throw new Error(`Invalid billing period: ${billingPeriod}`);
    }

    return Math.round(this.products[plan].prices[billingPeriod] * 100); // Convert to cents
  }

  /**
   * Get price ID for plan and billing period
   * @param {string} plan - 'weekly' or 'daily'
   * @param {string} billingPeriod - 'monthly' or 'yearly'
   * @returns {string} - Stripe price ID
   */
  getPriceId(plan, billingPeriod) {
    if (!this.products[plan]) {
      throw new Error(`Unknown plan: ${plan}`);
    }

    return this.products[plan].priceIds[billingPeriod];
  }

  /**
   * Create payment intent for checkout
   * @param {string} plan - 'weekly' or 'daily'
   * @param {string} email - Customer email
   * @param {string} billingPeriod - 'monthly' or 'yearly'
   * @returns {Promise<Object>} - Payment intent response
   */
  async createPaymentIntent(plan, email, billingPeriod = "monthly") {
    if (!this.validateEmail(email)) {
      throw new Error("Invalid email format");
    }

    if (!this.products[plan]) {
      throw new Error(`Unknown plan: ${plan}`);
    }

    try {
      const response = await fetch(
        this.baseUrl + "/api/create-payment-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plan,
            email,
            billingPeriod,
            amount: this.getPrice(plan, billingPeriod),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Payment intent creation failed: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to create payment intent:", error);
      throw error;
    }
  }

  /**
   * Process card payment
   * @param {string} clientSecret - Payment intent client secret
   * @param {Object} billingDetails - Billing details
   * @returns {Promise<Object>} - Confirmation result
   */
  async confirmCardPayment(clientSecret, billingDetails = {}) {
    if (!this.isInitialized) {
      throw new Error("Stripe client not initialized");
    }

    if (!clientSecret) {
      throw new Error("Client secret is required");
    }

    if (!this.cardElement) {
      throw new Error("Card element not mounted");
    }

    try {
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: billingDetails,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.paymentIntent;
    } catch (error) {
      console.error("Payment confirmation failed:", error);
      throw error;
    }
  }

  /**
   * Handle 3D Secure authentication
   * @param {string} clientSecret - Payment intent client secret
   * @param {Object} billingDetails - Billing details
   * @returns {Promise<Object>} - Confirmation result
   */
  async handle3DSecure(clientSecret, billingDetails = {}) {
    if (!this.isInitialized) {
      throw new Error("Stripe client not initialized");
    }

    try {
      const result = await this.stripe.handleCardAction(clientSecret);

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.paymentIntent;
    } catch (error) {
      console.error("3D Secure handling failed:", error);
      throw error;
    }
  }

  /**
   * Complete signup after successful payment
   * @param {string} email - Customer email
   * @param {string} plan - Selected plan
   * @param {string} billingPeriod - Billing period
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Promise<Object>} - Signup response from serverless function
   */
  async completeSignup(email, plan, billingPeriod, paymentIntentId) {
    if (!this.validateEmail(email)) {
      throw new Error("Invalid email format");
    }

    try {
      const response = await fetch(this.baseUrl + "/api/complete-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          plan,
          billingPeriod,
          paymentIntentId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`Signup completion failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to complete signup:", error);
      throw error;
    }
  }

  /**
   * Set billing period
   * @param {string} period - 'monthly' or 'yearly'
   */
  setBillingPeriod(period) {
    if (!["monthly", "yearly"].includes(period)) {
      throw new Error(`Invalid billing period: ${period}`);
    }
    this.currentBillingPeriod = period;
  }

  /**
   * Get billing period
   * @returns {string} - Current billing period
   */
  getBillingPeriod() {
    return this.currentBillingPeriod;
  }

  /**
   * Unmount card element
   */
  unmountCardElement() {
    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardElement = null;
    }
  }

  /**
   * Destroy Stripe client
   */
  destroy() {
    this.unmountCardElement();
    this.stripe = null;
    this.elements = null;
    this.isInitialized = false;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = StripeClient;
}
