/**
 * Payment Handler Module
 * Manages the complete payment checkout flow
 */

class PaymentHandler {
  constructor(stripeClient) {
    if (!stripeClient) {
      throw new Error('StripeClient instance is required');
    }

    this.stripeClient = stripeClient;
    this.isProcessing = false;
    this.currentPaymentState = null;
  }

  /**
   * Initiate checkout for a plan
   * @param {Object} params - Checkout parameters
   * @param {string} params.email - Customer email
   * @param {string} params.plan - 'weekly' or 'daily'
   * @param {string} params.billingPeriod - 'monthly' or 'yearly'
   * @param {Function} params.onSuccess - Success callback
   * @param {Function} params.onError - Error callback
   * @param {Function} params.onProcessing - Processing state callback
   * @returns {Promise<void>}
   */
  async startCheckout(params) {
    const {
      email,
      plan,
      billingPeriod = 'monthly',
      onSuccess,
      onError,
      onProcessing,
    } = params;

    if (!email || !plan) {
      const error = new Error('Email and plan are required');
      if (onError) onError(error);
      throw error;
    }

    this.isProcessing = true;
    if (onProcessing) onProcessing(true);

    try {
      // Step 1: Create payment intent on the server
      const paymentIntentData = await this.stripeClient.createPaymentIntent(
        plan,
        email,
        billingPeriod
      );

      this.currentPaymentState = {
        email,
        plan,
        billingPeriod,
        clientSecret: paymentIntentData.clientSecret,
        paymentIntentId: paymentIntentData.id,
      };

      // Step 2: Confirm payment with card
      const paymentResult = await this.stripeClient.confirmCardPayment(
        paymentIntentData.clientSecret,
        {
          name: email,
          email: email,
        }
      );

      // Step 3: Handle different payment statuses
      if (paymentResult.status === 'requires_action') {
        // 3D Secure or other authentication required
        const authResult = await this.stripeClient.handle3DSecure(
          paymentIntentData.clientSecret
        );

        if (authResult.status !== 'succeeded') {
          throw new Error('Payment authentication failed');
        }
      } else if (paymentResult.status !== 'succeeded') {
        throw new Error(`Payment failed with status: ${paymentResult.status}`);
      }

      // Step 4: Complete signup in database
      const signupResult = await this.stripeClient.completeSignup(
        email,
        plan,
        billingPeriod,
        paymentIntentData.id
      );

      if (onSuccess) {
        onSuccess({
          ...signupResult,
          paymentIntentId: paymentIntentData.id,
        });
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      this.currentPaymentState = null;
      if (onError) onError(error);
      throw error;
    } finally {
      this.isProcessing = false;
      if (onProcessing) onProcessing(false);
    }
  }

  /**
   * Get current payment state
   * @returns {Object|null}
   */
  getPaymentState() {
    return this.currentPaymentState;
  }

  /**
   * Clear payment state
   */
  clearPaymentState() {
    this.currentPaymentState = null;
  }

  /**
   * Check if payment is processing
   * @returns {boolean}
   */
  isPaymentProcessing() {
    return this.isProcessing;
  }

  /**
   * Get pricing information
   * @param {string} plan - 'weekly' or 'daily'
   * @param {string} billingPeriod - 'monthly' or 'yearly'
   * @returns {Object}
   */
  getPricingInfo(plan, billingPeriod) {
    return {
      plan,
      billingPeriod,
      amount: this.stripeClient.getPrice(plan, billingPeriod),
      amountFormatted: this.formatPrice(
        this.stripeClient.getPrice(plan, billingPeriod) / 100
      ),
      priceId: this.stripeClient.getPriceId(plan, billingPeriod),
    };
  }

  /**
   * Format price for display
   * @param {number} price - Price in dollars
   * @returns {string}
   */
  formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }

  /**
   * Get all products and pricing
   * @returns {Object}
   */
  getProductsInfo() {
    const products = {};
    for (const [planKey, planData] of Object.entries(
      this.stripeClient.products
    )) {
      products[planKey] = {
        name: planData.name,
        description: planData.description,
        pricing: {
          monthly: this.formatPrice(planData.prices.monthly),
          yearly: this.formatPrice(planData.prices.yearly),
        },
      };
    }
    return products;
  }

  /**
   * Validate checkout parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} - Validation result with isValid and errors
   */
  validateCheckoutParams(params) {
    const errors = [];

    if (!params.email) {
      errors.push('Email is required');
    } else if (!this.stripeClient.validateEmail(params.email)) {
      errors.push('Invalid email format');
    }

    if (!params.plan) {
      errors.push('Plan is required');
    } else if (!this.stripeClient.products[params.plan]) {
      errors.push(`Unknown plan: ${params.plan}`);
    }

    const billingPeriod = params.billingPeriod || 'monthly';
    if (!['monthly', 'yearly'].includes(billingPeriod)) {
      errors.push('Invalid billing period');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaymentHandler;
}
