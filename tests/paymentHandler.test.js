/**
 * PaymentHandler Tests
 * Unit tests for the PaymentHandler module
 */

const PaymentHandler = require("../src/js/stripe/paymentHandler");

describe("PaymentHandler", () => {
  let paymentHandler;
  let stripeClient;

  beforeEach(() => {
    // Create a mock StripeClient
    stripeClient = {
      products: {
        weekly: {
          name: "Weekly Digest",
          prices: {
            monthly: 4.99,
            yearly: 49.9,
          },
          priceIds: {
            monthly: "price_weekly_monthly",
            yearly: "price_weekly_yearly",
          },
        },
        daily: {
          name: "Daily Briefing",
          prices: {
            monthly: 7.99,
            yearly: 79.9,
          },
          priceIds: {
            monthly: "price_daily_monthly",
            yearly: "price_daily_yearly",
          },
        },
      },
      validateEmail: jest.fn((email) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      ),
      getPrice: jest.fn((plan, period) => {
        const prices = {
          weekly: { monthly: 499, yearly: 4990 },
          daily: { monthly: 799, yearly: 7990 },
        };
        return prices[plan][period];
      }),
      getPriceId: jest.fn((plan, period) => {
        return stripeClient.products[plan].priceIds[period];
      }),
      createPaymentIntent: jest.fn(),
      confirmCardPayment: jest.fn(),
      handle3DSecure: jest.fn(),
      completeSignup: jest.fn(),
      setBillingPeriod: jest.fn(),
    };

    paymentHandler = new PaymentHandler(stripeClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should throw error if StripeClient is missing", () => {
      expect(() => new PaymentHandler()).toThrow(
        "StripeClient instance is required",
      );
    });

    it("should initialize with valid StripeClient", () => {
      expect(paymentHandler.stripeClient).toBe(stripeClient);
      expect(paymentHandler.isProcessing).toBe(false);
      expect(paymentHandler.currentPaymentState).toBe(null);
    });
  });

  describe("startCheckout", () => {
    it("should throw error if email is missing", async () => {
      const params = {
        plan: "weekly",
        onError: jest.fn(),
      };

      await expect(paymentHandler.startCheckout(params)).rejects.toThrow(
        "Email and plan are required",
      );
      expect(params.onError).toHaveBeenCalled();
    });

    it("should throw error if plan is missing", async () => {
      const params = {
        email: "test@example.com",
        onError: jest.fn(),
      };

      await expect(paymentHandler.startCheckout(params)).rejects.toThrow(
        "Email and plan are required",
      );
      expect(params.onError).toHaveBeenCalled();
    });

    it("should successfully process payment", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "succeeded",
      });

      stripeClient.completeSignup.mockResolvedValueOnce({
        success: true,
        email: "test@example.com",
        subscriptionId: "sub_123",
      });

      const onSuccess = jest.fn();
      const onProcessing = jest.fn();

      await paymentHandler.startCheckout({
        email: "test@example.com",
        plan: "weekly",
        billingPeriod: "monthly",
        onSuccess,
        onProcessing,
      });

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentIntentId: "pi_test_123",
        }),
      );
      expect(onProcessing).toHaveBeenCalledWith(true);
      expect(onProcessing).toHaveBeenCalledWith(false);
    });

    it("should handle 3D Secure authentication", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "requires_action",
      });

      stripeClient.handle3DSecure.mockResolvedValueOnce({
        status: "succeeded",
      });

      stripeClient.completeSignup.mockResolvedValueOnce({
        success: true,
        email: "test@example.com",
      });

      const onSuccess = jest.fn();

      await paymentHandler.startCheckout({
        email: "test@example.com",
        plan: "weekly",
        onSuccess,
      });

      expect(stripeClient.handle3DSecure).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    it("should fail on authentication failure", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "requires_action",
      });

      stripeClient.handle3DSecure.mockResolvedValueOnce({
        status: "failed",
      });

      const onError = jest.fn();

      await expect(
        paymentHandler.startCheckout({
          email: "test@example.com",
          plan: "weekly",
          onError,
        }),
      ).rejects.toThrow("Payment authentication failed");

      expect(onError).toHaveBeenCalled();
    });

    it("should fail on payment failure", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "failed",
      });

      const onError = jest.fn();

      await expect(
        paymentHandler.startCheckout({
          email: "test@example.com",
          plan: "weekly",
          onError,
        }),
      ).rejects.toThrow("Payment failed with status: failed");

      expect(onError).toHaveBeenCalled();
    });

    it("should use default billing period", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "succeeded",
      });

      stripeClient.completeSignup.mockResolvedValueOnce({
        success: true,
      });

      await paymentHandler.startCheckout({
        email: "test@example.com",
        plan: "weekly",
      });

      const callArgs = stripeClient.createPaymentIntent.mock.calls[0];
      expect(callArgs[2]).toBe("monthly");
    });

    it("should clear payment state on error", async () => {
      stripeClient.createPaymentIntent.mockRejectedValueOnce(
        new Error("API error"),
      );

      const onError = jest.fn();

      await expect(
        paymentHandler.startCheckout({
          email: "test@example.com",
          plan: "weekly",
          onError,
        }),
      ).rejects.toThrow("API error");

      expect(paymentHandler.currentPaymentState).toBe(null);
    });
  });

  describe("getPaymentState", () => {
    it("should return null when no payment in progress", () => {
      expect(paymentHandler.getPaymentState()).toBe(null);
    });

    it("should return payment state after checkout", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "succeeded",
      });

      stripeClient.completeSignup.mockResolvedValueOnce({
        success: true,
      });

      await paymentHandler.startCheckout({
        email: "test@example.com",
        plan: "weekly",
        billingPeriod: "yearly",
      });

      const state = paymentHandler.getPaymentState();
      expect(state).toEqual(
        expect.objectContaining({
          email: "test@example.com",
          plan: "weekly",
          billingPeriod: "yearly",
          clientSecret: "pi_test_secret_123",
          paymentIntentId: "pi_test_123",
        }),
      );
    });
  });

  describe("clearPaymentState", () => {
    it("should clear current payment state", async () => {
      stripeClient.createPaymentIntent.mockResolvedValueOnce({
        clientSecret: "pi_test_secret_123",
        id: "pi_test_123",
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "succeeded",
      });

      stripeClient.completeSignup.mockResolvedValueOnce({
        success: true,
      });

      await paymentHandler.startCheckout({
        email: "test@example.com",
        plan: "weekly",
      });

      expect(paymentHandler.getPaymentState()).not.toBe(null);

      paymentHandler.clearPaymentState();
      expect(paymentHandler.getPaymentState()).toBe(null);
    });
  });

  describe("isPaymentProcessing", () => {
    it("should return false initially", () => {
      expect(paymentHandler.isPaymentProcessing()).toBe(false);
    });

    it("should return true during payment processing", (done) => {
      stripeClient.createPaymentIntent.mockImplementationOnce(() => {
        expect(paymentHandler.isPaymentProcessing()).toBe(true);
        done();
        return Promise.resolve({
          clientSecret: "pi_test_secret_123",
          id: "pi_test_123",
        });
      });

      stripeClient.confirmCardPayment.mockResolvedValueOnce({
        status: "succeeded",
      });

      stripeClient.completeSignup.mockResolvedValueOnce({
        success: true,
      });

      paymentHandler.startCheckout({
        email: "test@example.com",
        plan: "weekly",
      });
    });
  });

  describe("getPricingInfo", () => {
    it("should return pricing information for plan and period", () => {
      const info = paymentHandler.getPricingInfo("weekly", "monthly");

      expect(info).toEqual(
        expect.objectContaining({
          plan: "weekly",
          billingPeriod: "monthly",
          amount: 499,
          amountFormatted: "$4.99",
          priceId: "price_weekly_monthly",
        }),
      );
    });

    it("should format price correctly", () => {
      const info = paymentHandler.getPricingInfo("daily", "yearly");
      expect(info.amountFormatted).toBe("$79.90");
    });
  });

  describe("getProductsInfo", () => {
    it("should return all products with pricing", () => {
      const products = paymentHandler.getProductsInfo();

      expect(products).toHaveProperty("weekly");
      expect(products).toHaveProperty("daily");
      expect(products.weekly).toHaveProperty("name");
      expect(products.weekly).toHaveProperty("description");
      expect(products.weekly).toHaveProperty("pricing");
    });

    it("should format prices in product info", () => {
      const products = paymentHandler.getProductsInfo();

      expect(products.weekly.pricing.monthly).toBe("$4.99");
      expect(products.daily.pricing.yearly).toBe("$79.90");
    });
  });

  describe("validateCheckoutParams", () => {
    it("should validate correct parameters", () => {
      const result = paymentHandler.validateCheckoutParams({
        email: "test@example.com",
        plan: "weekly",
        billingPeriod: "monthly",
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing email", () => {
      const result = paymentHandler.validateCheckoutParams({
        plan: "weekly",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email is required");
    });

    it("should reject invalid email format", () => {
      const result = paymentHandler.validateCheckoutParams({
        email: "invalid-email",
        plan: "weekly",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid email format");
    });

    it("should reject missing plan", () => {
      const result = paymentHandler.validateCheckoutParams({
        email: "test@example.com",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Plan is required");
    });

    it("should reject unknown plan", () => {
      const result = paymentHandler.validateCheckoutParams({
        email: "test@example.com",
        plan: "unknown",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unknown plan: unknown");
    });

    it("should reject invalid billing period", () => {
      const result = paymentHandler.validateCheckoutParams({
        email: "test@example.com",
        plan: "weekly",
        billingPeriod: "invalid",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid billing period");
    });

    it("should use default billing period in validation", () => {
      const result = paymentHandler.validateCheckoutParams({
        email: "test@example.com",
        plan: "weekly",
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("formatPrice", () => {
    it("should format price as USD currency", () => {
      const formatted = paymentHandler.formatPrice(4.99);
      expect(formatted).toBe("$4.99");
    });

    it("should format large amounts correctly", () => {
      const formatted = paymentHandler.formatPrice(1234.56);
      expect(formatted).toBe("$1,234.56");
    });

    it("should format zero correctly", () => {
      const formatted = paymentHandler.formatPrice(0);
      expect(formatted).toBe("$0.00");
    });
  });
});
