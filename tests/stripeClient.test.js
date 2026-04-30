/**
 * StripeClient Tests
 * Unit tests for the StripeClient module
 */

const StripeClient = require("../src/js/stripe/stripeClient");

describe("StripeClient", () => {
  let stripeClient;
  const PUBLISHABLE_KEY = "pk_test_123456789";

  beforeEach(() => {
    stripeClient = new StripeClient(PUBLISHABLE_KEY);
    // Mock fetch
    global.fetch = jest.fn();
    // Mock Stripe
    window.Stripe = jest.fn(() => ({
      elements: jest.fn(() => ({
        create: jest.fn(() => ({})),
      })),
      confirmCardPayment: jest.fn(),
      handleCardAction: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (stripeClient) {
      stripeClient.destroy();
    }
  });

  describe("Constructor", () => {
    it("should throw error if publishable key is missing", () => {
      expect(() => new StripeClient()).toThrow(
        "Stripe publishable key is required",
      );
    });

    it("should initialize with valid publishable key", () => {
      const client = new StripeClient(PUBLISHABLE_KEY);
      expect(client.publishableKey).toBe(PUBLISHABLE_KEY);
      expect(client.isInitialized).toBe(false);
    });

    it("should have products configured", () => {
      expect(stripeClient.products).toHaveProperty("weekly");
      expect(stripeClient.products).toHaveProperty("daily");
    });

    it("should have correct pricing for weekly plan", () => {
      expect(stripeClient.products.weekly.prices.monthly).toBe(4.99);
      expect(stripeClient.products.weekly.prices.yearly).toBe(49.9);
    });

    it("should have correct pricing for daily plan", () => {
      expect(stripeClient.products.daily.prices.monthly).toBe(7.99);
      expect(stripeClient.products.daily.prices.yearly).toBe(79.9);
    });
  });

  describe("Email Validation", () => {
    it("should validate correct email format", () => {
      expect(stripeClient.validateEmail("test@example.com")).toBe(true);
      expect(stripeClient.validateEmail("user+tag@domain.co.uk")).toBe(true);
    });

    it("should reject invalid email formats", () => {
      expect(stripeClient.validateEmail("invalid")).toBe(false);
      expect(stripeClient.validateEmail("invalid@")).toBe(false);
      expect(stripeClient.validateEmail("@example.com")).toBe(false);
      expect(stripeClient.validateEmail("test@")).toBe(false);
    });

    it("should reject empty email", () => {
      expect(stripeClient.validateEmail("")).toBe(false);
    });
  });

  describe("Pricing", () => {
    it("should get price in cents for weekly monthly plan", () => {
      const price = stripeClient.getPrice("weekly", "monthly");
      expect(price).toBe(499); // $4.99 in cents
    });

    it("should get price in cents for daily yearly plan", () => {
      const price = stripeClient.getPrice("daily", "yearly");
      expect(price).toBe(7990); // $79.90 in cents
    });

    it("should throw error for unknown plan", () => {
      expect(() => stripeClient.getPrice("unknown", "monthly")).toThrow(
        "Unknown plan: unknown",
      );
    });

    it("should throw error for invalid billing period", () => {
      expect(() => stripeClient.getPrice("weekly", "invalid")).toThrow(
        "Invalid billing period: invalid",
      );
    });

    it("should get price ID for plan and billing period", () => {
      const priceId = stripeClient.getPriceId("weekly", "monthly");
      expect(priceId).toBe("price_weekly_monthly");
    });

    it("should throw error for unknown plan in getPriceId", () => {
      expect(() => stripeClient.getPriceId("unknown", "monthly")).toThrow(
        "Unknown plan: unknown",
      );
    });
  });

  describe("Initialization", () => {
    it("should initialize Stripe client", async () => {
      // Mock Stripe.js loading
      window.Stripe = jest.fn(() => ({
        elements: jest.fn(() => ({})),
      }));

      const result = await stripeClient.init();
      expect(result).toBe(true);
      expect(stripeClient.isInitialized).toBe(true);
      expect(stripeClient.stripe).toBeDefined();
    });

    it("should throw error if Stripe initialization fails", async () => {
      window.Stripe = jest.fn(() => null);
      await expect(stripeClient.init()).rejects.toThrow(
        "Failed to initialize Stripe",
      );
    });

    it("should throw error if elements creation fails", async () => {
      window.Stripe = jest.fn(() => ({
        elements: jest.fn(() => null),
      }));
      await expect(stripeClient.init()).rejects.toThrow(
        "Failed to create Stripe elements",
      );
    });
  });

  describe("Card Element", () => {
    beforeEach(async () => {
      window.Stripe = jest.fn(() => ({
        elements: jest.fn(() => ({
          create: jest.fn(() => ({
            mount: jest.fn(),
            unmount: jest.fn(),
          })),
        })),
      }));
      await stripeClient.init();
    });

    it("should throw error if not initialized before mounting", () => {
      const client = new StripeClient(PUBLISHABLE_KEY);
      expect(() => client.mountCardElement("card")).toThrow(
        "Stripe client not initialized",
      );
    });

    it("should throw error if element not found", async () => {
      expect(() => stripeClient.mountCardElement("nonexistent")).toThrow(
        'Element with id "nonexistent" not found',
      );
    });

    it("should mount card element successfully", async () => {
      document.body.innerHTML = '<div id="card-element"></div>';
      const result = stripeClient.mountCardElement("card-element");
      expect(result).toBe(true);
    });

    it("should unmount card element", async () => {
      document.body.innerHTML = '<div id="card-element"></div>';
      stripeClient.mountCardElement("card-element");
      stripeClient.unmountCardElement();
      expect(stripeClient.cardElement).toBe(null);
    });
  });

  describe("Billing Period Management", () => {
    it("should set billing period to monthly", () => {
      stripeClient.setBillingPeriod("monthly");
      expect(stripeClient.getBillingPeriod()).toBe("monthly");
    });

    it("should set billing period to yearly", () => {
      stripeClient.setBillingPeriod("yearly");
      expect(stripeClient.getBillingPeriod()).toBe("yearly");
    });

    it("should throw error for invalid billing period", () => {
      expect(() => stripeClient.setBillingPeriod("invalid")).toThrow(
        "Invalid billing period: invalid",
      );
    });
  });

  describe("Payment Intent Creation", () => {
    it("should create payment intent with valid parameters", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          clientSecret: "pi_test_secret_123",
          id: "pi_test_123",
        }),
      });

      const result = await stripeClient.createPaymentIntent(
        "weekly",
        "test@example.com",
        "monthly",
      );
      expect(result.clientSecret).toBe("pi_test_secret_123");
      expect(result.id).toBe("pi_test_123");
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/create-payment-intent",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("should throw error for invalid email", async () => {
      await expect(
        stripeClient.createPaymentIntent("weekly", "invalid", "monthly"),
      ).rejects.toThrow("Invalid email format");
    });

    it("should throw error for unknown plan", async () => {
      await expect(
        stripeClient.createPaymentIntent(
          "unknown",
          "test@example.com",
          "monthly",
        ),
      ).rejects.toThrow("Unknown plan: unknown");
    });

    it("should throw error on fetch failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(
        stripeClient.createPaymentIntent(
          "weekly",
          "test@example.com",
          "monthly",
        ),
      ).rejects.toThrow("Payment intent creation failed");
    });
  });

  describe("Complete Signup", () => {
    it("should complete signup with valid parameters", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          email: "test@example.com",
          subscriptionId: "sub_123",
        }),
      });

      const result = await stripeClient.completeSignup(
        "test@example.com",
        "weekly",
        "monthly",
        "pi_test_123",
      );

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/complete-signup",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should throw error for invalid email in signup", async () => {
      await expect(
        stripeClient.completeSignup(
          "invalid",
          "weekly",
          "monthly",
          "pi_test_123",
        ),
      ).rejects.toThrow("Invalid email format");
    });

    it("should throw error on signup fetch failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(
        stripeClient.completeSignup(
          "test@example.com",
          "weekly",
          "monthly",
          "pi_test_123",
        ),
      ).rejects.toThrow("Signup completion failed");
    });

    it("should include required fields in signup request", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await stripeClient.completeSignup(
        "test@example.com",
        "weekly",
        "monthly",
        "pi_test_123",
      );

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.email).toBe("test@example.com");
      expect(body.plan).toBe("weekly");
      expect(body.billingPeriod).toBe("monthly");
      expect(body.paymentIntentId).toBe("pi_test_123");
      expect(body.timestamp).toBeDefined();
      expect(body.userAgent).toBeDefined();
    });
  });

  describe("Destroy", () => {
    it("should clean up resources on destroy", async () => {
      window.Stripe = jest.fn(() => ({
        elements: jest.fn(() => ({
          create: jest.fn(() => ({
            mount: jest.fn(),
            unmount: jest.fn(),
          })),
        })),
      }));

      await stripeClient.init();
      document.body.innerHTML = '<div id="card-element"></div>';
      stripeClient.mountCardElement("card-element");

      stripeClient.destroy();

      expect(stripeClient.isInitialized).toBe(false);
      expect(stripeClient.stripe).toBe(null);
      expect(stripeClient.cardElement).toBe(null);
    });
  });
});
