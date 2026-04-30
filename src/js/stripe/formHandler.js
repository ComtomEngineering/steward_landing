/**
 * Form Handler Module
 * Manages checkout form interactions and submissions
 */

class FormHandler {
  constructor(paymentHandler) {
    if (!paymentHandler) {
      throw new Error("PaymentHandler instance is required");
    }

    this.paymentHandler = paymentHandler;
    this.formElement = null;
    this.emailInput = null;
    this.submitButton = null;
    this.errorContainer = null;
    this.successContainer = null;
    this.selectedPlan = null;
    this.selectedBillingPeriod = "monthly";
    this.isFormValid = false;
  }

  /**
   * Initialize form with DOM elements
   * @param {Object} params - Form configuration
   * @param {string} params.formSelector - CSS selector for form element
   * @param {string} params.emailSelector - CSS selector for email input
   * @param {string} params.submitSelector - CSS selector for submit button
   * @param {string} params.errorSelector - CSS selector for error container
   * @param {string} params.successSelector - CSS selector for success container
   * @returns {boolean}
   */
  init(params) {
    try {
      const {
        formSelector,
        emailSelector,
        submitSelector,
        errorSelector,
        successSelector,
      } = params;

      this.formElement = document.querySelector(formSelector);
      this.emailInput = document.querySelector(emailSelector);
      this.submitButton = document.querySelector(submitSelector);
      this.errorContainer = document.querySelector(errorSelector);
      this.successContainer = document.querySelector(successSelector);

      if (!this.formElement || !this.emailInput || !this.submitButton) {
        throw new Error("Required form elements not found");
      }

      this.setupEventListeners();
      return true;
    } catch (error) {
      console.error("Form initialization failed:", error);
      throw error;
    }
  }

  /**
   * Setup event listeners for form
   * @private
   */
  setupEventListeners() {
    this.formElement.addEventListener("submit", (e) => this.handleSubmit(e));
    this.emailInput.addEventListener("input", () => this.validateEmail());
    this.emailInput.addEventListener("blur", () => this.validateEmail());
  }

  /**
   * Validate email input
   * @returns {boolean}
   */
  validateEmail() {
    const email = this.emailInput.value.trim();
    const isValid = this.paymentHandler.stripeClient.validateEmail(email);

    if (!email) {
      this.setFieldError(this.emailInput, "Email is required");
      this.isFormValid = false;
      return false;
    }

    if (!isValid) {
      this.setFieldError(this.emailInput, "Please enter a valid email");
      this.isFormValid = false;
      return false;
    }

    this.clearFieldError(this.emailInput);
    this.isFormValid = true;
    return true;
  }

  /**
   * Set field error state
   * @param {HTMLElement} field - Input field element
   * @param {string} message - Error message
   * @private
   */
  setFieldError(field, message) {
    field.classList.add("error");
    field.setAttribute("aria-invalid", "true");

    let errorEl = field.nextElementSibling;
    if (!errorEl || !errorEl.classList.contains("field-error")) {
      errorEl = document.createElement("div");
      errorEl.classList.add("field-error");
      field.parentNode.insertBefore(errorEl, field.nextSibling);
    }
    errorEl.textContent = message;
    errorEl.setAttribute("role", "alert");
  }

  /**
   * Clear field error state
   * @param {HTMLElement} field - Input field element
   * @private
   */
  clearFieldError(field) {
    field.classList.remove("error");
    field.setAttribute("aria-invalid", "false");

    const errorEl = field.nextElementSibling;
    if (errorEl && errorEl.classList.contains("field-error")) {
      errorEl.remove();
    }
  }

  /**
   * Show error message to user
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  showError(message, details = {}) {
    if (this.errorContainer) {
      this.errorContainer.innerHTML = `
        <div class="error-message" role="alert">
          <span>${this.escapeHtml(message)}</span>
          ${details.code ? `<small>${this.escapeHtml(details.code)}</small>` : ""}
        </div>
      `;
      this.errorContainer.style.display = "block";
    }
  }

  /**
   * Clear error message
   */
  clearError() {
    if (this.errorContainer) {
      this.errorContainer.innerHTML = "";
      this.errorContainer.style.display = "none";
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   * @param {Object} details - Additional details
   */
  showSuccess(message, details = {}) {
    if (this.successContainer) {
      this.successContainer.innerHTML = `
        <div class="success-message" role="status">
          <span>${this.escapeHtml(message)}</span>
          ${details.email ? `<small>Confirmation sent to ${this.escapeHtml(details.email)}</small>` : ""}
        </div>
      `;
      this.successContainer.style.display = "block";
    }
  }

  /**
   * Clear success message
   */
  clearSuccess() {
    if (this.successContainer) {
      this.successContainer.innerHTML = "";
      this.successContainer.style.display = "none";
    }
  }

  /**
   * Set submit button state
   * @param {boolean} disabled - Whether button should be disabled
   * @param {string} text - Button text
   * @private
   */
  setSubmitButtonState(disabled, text = null) {
    this.submitButton.disabled = disabled;
    if (text) {
      this.submitButton.textContent = text;
    }
  }

  /**
   * Handle form submission
   * @param {Event} event - Form submit event
   * @private
   */
  async handleSubmit(event) {
    event.preventDefault();

    if (this.paymentHandler.isPaymentProcessing()) {
      return;
    }

    this.clearError();
    this.clearSuccess();

    // Validate form
    if (!this.validateEmail()) {
      this.showError("Please fix the errors above");
      return;
    }

    if (!this.selectedPlan) {
      this.showError("Please select a plan");
      return;
    }

    const email = this.emailInput.value.trim();

    try {
      this.setSubmitButtonState(true, "Processing...");

      await this.paymentHandler.startCheckout({
        email,
        plan: this.selectedPlan,
        billingPeriod: this.selectedBillingPeriod,
        onSuccess: (result) => this.handleSuccess(result),
        onError: (error) => this.handleError(error),
        onProcessing: (isProcessing) => {
          if (!isProcessing) {
            this.setSubmitButtonState(false);
          }
        },
      });
    } catch (error) {
      this.handleError(error);
      this.setSubmitButtonState(false);
    }
  }

  /**
   * Handle successful payment
   * @param {Object} result - Success result from payment
   * @private
   */
  handleSuccess(result) {
    const email = result.email || this.emailInput.value;

    // Reset form first to clear input values and state
    this.reset();

    // Show success message after reset so it remains visible
    this.showSuccess(
      "Welcome! Your subscription is active. Check your email for next steps.",
      { email },
    );

    // Dispatch custom event for tracking/analytics
    window.dispatchEvent(
      new CustomEvent("signupSuccess", {
        detail: result,
      }),
    );
  }

  /**
   * Handle payment error
   * @param {Error} error - Error object
   * @private
   */
  handleError(error) {
    console.error("Payment error:", error);
    this.showError(
      error.message || "Payment processing failed. Please try again.",
      { code: error.code },
    );

    // Dispatch custom event for tracking/analytics
    window.dispatchEvent(
      new CustomEvent("signupError", {
        detail: {
          error: error.message,
          code: error.code,
        },
      }),
    );
  }

  /**
   * Set selected plan
   * @param {string} plan - Plan ID ('weekly' or 'daily')
   */
  selectPlan(plan) {
    if (!this.paymentHandler.stripeClient.products[plan]) {
      throw new Error(`Unknown plan: ${plan}`);
    }
    this.selectedPlan = plan;
  }

  /**
   * Set billing period
   * @param {string} period - Billing period ('monthly' or 'yearly')
   */
  setBillingPeriod(period) {
    if (!["monthly", "yearly"].includes(period)) {
      throw new Error(`Invalid billing period: ${period}`);
    }
    this.selectedBillingPeriod = period;
    this.paymentHandler.stripeClient.setBillingPeriod(period);
  }

  /**
   * Get form state
   * @returns {Object}
   */
  getFormState() {
    return {
      email: this.emailInput.value.trim(),
      plan: this.selectedPlan,
      billingPeriod: this.selectedBillingPeriod,
      isValid: this.isFormValid,
      isProcessing: this.paymentHandler.isPaymentProcessing(),
    };
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string}
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Reset form to initial state
   */
  reset() {
    this.formElement.reset();
    this.emailInput.value = "";
    this.isFormValid = false;
    this.selectedPlan = null;
    this.selectedBillingPeriod = "monthly";
    this.clearError();
    this.clearSuccess();
    this.clearFieldError(this.emailInput);
    this.setSubmitButtonState(false);
  }

  /**
   * Destroy form handler
   */
  destroy() {
    if (this.formElement) {
      this.formElement.removeEventListener("submit", (e) =>
        this.handleSubmit(e),
      );
    }
    if (this.emailInput) {
      this.emailInput.removeEventListener("input", () => this.validateEmail());
      this.emailInput.removeEventListener("blur", () => this.validateEmail());
    }
    this.formElement = null;
    this.emailInput = null;
    this.submitButton = null;
    this.errorContainer = null;
    this.successContainer = null;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = FormHandler;
}
