/**
 * FormHandler Tests
 * Unit tests for the FormHandler module
 */
const FormHandler = require("../src/js/stripe/formHandler");

describe('FormHandler', () => {
  let formHandler;
  let paymentHandler;
  let mockForm;
  let mockEmailInput;
  let mockSubmitButton;
  let mockErrorContainer;
  let mockSuccessContainer;

  beforeEach(() => {
    // Create mock PaymentHandler
    paymentHandler = {
      stripeClient: {
        validateEmail: jest.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
      setBillingPeriod: jest.fn(),
        products: {
          weekly: { name: 'Weekly Digest' },
          daily: { name: 'Daily Briefing' },
        },
      },
      isPaymentProcessing: jest.fn(() => false),
      startCheckout: jest.fn(),
    };

    // Create mock DOM elements
    mockForm = document.createElement('form');
    mockEmailInput = document.createElement('input');
    mockEmailInput.type = 'email';
    mockSubmitButton = document.createElement('button');
    mockErrorContainer = document.createElement('div');
    mockSuccessContainer = document.createElement('div');

    mockForm.id = 'test-form';
    mockEmailInput.id = 'test-email';
    mockSubmitButton.id = 'test-submit';
    mockErrorContainer.id = 'test-error';
    mockSuccessContainer.id = 'test-success';

    document.body.appendChild(mockForm);
    document.body.appendChild(mockEmailInput);
    document.body.appendChild(mockSubmitButton);
    document.body.appendChild(mockErrorContainer);
    document.body.appendChild(mockSuccessContainer);

    formHandler = new FormHandler(paymentHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    it('should throw error if PaymentHandler is missing', () => {
      expect(() => new FormHandler()).toThrow('PaymentHandler instance is required');
    });

    it('should initialize with valid PaymentHandler', () => {
      expect(formHandler.paymentHandler).toBe(paymentHandler);
      expect(formHandler.isFormValid).toBe(false);
      expect(formHandler.selectedPlan).toBe(null);
    });

    it('should set default billing period to monthly', () => {
      expect(formHandler.selectedBillingPeriod).toBe('monthly');
    });
  });

  describe('Init', () => {
    it('should initialize form with required elements', () => {
      const result = formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });

      expect(result).toBe(true);
      expect(formHandler.formElement).toBe(mockForm);
      expect(formHandler.emailInput).toBe(mockEmailInput);
      expect(formHandler.submitButton).toBe(mockSubmitButton);
    });

    it('should throw error if form element not found', () => {
      expect(() => {
        formHandler.init({
          formSelector: '#nonexistent',
          emailSelector: '#test-email',
          submitSelector: '#test-submit',
        });
      }).toThrow('Required form elements not found');
    });

    it('should throw error if email input not found', () => {
      expect(() => {
        formHandler.init({
          formSelector: '#test-form',
          emailSelector: '#nonexistent',
          submitSelector: '#test-submit',
        });
      }).toThrow('Required form elements not found');
    });

    it('should throw error if submit button not found', () => {
      expect(() => {
        formHandler.init({
          formSelector: '#test-form',
          emailSelector: '#test-email',
          submitSelector: '#nonexistent',
        });
      }).toThrow('Required form elements not found');
    });

    it('should setup event listeners', () => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });

      const addEventListenerSpy = jest.spyOn(mockForm, 'addEventListener');
      formHandler.setupEventListeners();
      expect(addEventListenerSpy).toHaveBeenCalledWith('submit', expect.any(Function));
    });
  });

  describe('Email Validation', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should validate correct email', () => {
      mockEmailInput.value = 'test@example.com';
      const result = formHandler.validateEmail();
      expect(result).toBe(true);
      expect(formHandler.isFormValid).toBe(true);
    });

    it('should reject invalid email format', () => {
      mockEmailInput.value = 'invalid-email';
      const result = formHandler.validateEmail();
      expect(result).toBe(false);
      expect(formHandler.isFormValid).toBe(false);
    });

    it('should reject empty email', () => {
      mockEmailInput.value = '';
      const result = formHandler.validateEmail();
      expect(result).toBe(false);
      expect(formHandler.isFormValid).toBe(false);
    });

    it('should reject whitespace-only email', () => {
      mockEmailInput.value = '   ';
      const result = formHandler.validateEmail();
      expect(result).toBe(false);
    });

    it('should display error message for invalid email', () => {
      mockEmailInput.value = 'invalid';
      formHandler.validateEmail();
      expect(mockEmailInput.classList.contains('error')).toBe(true);
      expect(mockEmailInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should clear error on valid email', () => {
      mockEmailInput.value = 'invalid';
      formHandler.validateEmail();
      mockEmailInput.value = 'valid@example.com';
      formHandler.validateEmail();
      expect(mockEmailInput.classList.contains('error')).toBe(false);
      expect(mockEmailInput.getAttribute('aria-invalid')).toBe('false');
    });
  });

  describe('Field Error Handling', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should set field error state', () => {
      formHandler.setFieldError(mockEmailInput, 'Test error message');
      expect(mockEmailInput.classList.contains('error')).toBe(true);
      expect(mockEmailInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('should create error element if not exists', () => {
      formHandler.setFieldError(mockEmailInput, 'Error message');
      const errorEl = mockEmailInput.nextElementSibling;
      expect(errorEl).not.toBeNull();
      expect(errorEl.classList.contains('field-error')).toBe(true);
      expect(errorEl.textContent).toBe('Error message');
    });

    it('should clear field error state', () => {
      formHandler.setFieldError(mockEmailInput, 'Error');
      formHandler.clearFieldError(mockEmailInput);
      expect(mockEmailInput.classList.contains('error')).toBe(false);
      expect(mockEmailInput.getAttribute('aria-invalid')).toBe('false');
    });

    it('should remove error element on clear', () => {
      formHandler.setFieldError(mockEmailInput, 'Error');
      const errorEl = mockEmailInput.nextElementSibling;
      formHandler.clearFieldError(mockEmailInput);
      expect(mockEmailInput.nextElementSibling).not.toBe(errorEl);
    });
  });

  describe('Error Messaging', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should show error message', () => {
      formHandler.showError('Test error');
      expect(mockErrorContainer.style.display).toBe('block');
      expect(mockErrorContainer.textContent).toContain('Test error');
    });

    it('should include error code in message', () => {
      formHandler.showError('Payment failed', { code: 'card_declined' });
      expect(mockErrorContainer.textContent).toContain('card_declined');
    });

    it('should escape HTML in error messages', () => {
      formHandler.showError('<script>alert("xss")</script>');
      expect(mockErrorContainer.innerHTML).not.toContain('<script>');
    });

    it('should clear error message', () => {
      formHandler.showError('Error');
      formHandler.clearError();
      expect(mockErrorContainer.style.display).toBe('none');
      expect(mockErrorContainer.innerHTML).toBe('');
    });
  });

  describe('Success Messaging', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should show success message', () => {
      formHandler.showSuccess('Signup successful');
      expect(mockSuccessContainer.style.display).toBe('block');
      expect(mockSuccessContainer.textContent).toContain('Signup successful');
    });

    it('should include email in success message', () => {
      formHandler.showSuccess('Welcome', { email: 'test@example.com' });
      expect(mockSuccessContainer.textContent).toContain('test@example.com');
    });

    it('should escape HTML in success messages', () => {
      formHandler.showSuccess('<script>alert("xss")</script>');
      expect(mockSuccessContainer.innerHTML).not.toContain('<script>');
    });

    it('should clear success message', () => {
      formHandler.showSuccess('Success');
      formHandler.clearSuccess();
      expect(mockSuccessContainer.style.display).toBe('none');
      expect(mockSuccessContainer.innerHTML).toBe('');
    });
  });

  describe('Submit Button State', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should disable submit button', () => {
      formHandler.setSubmitButtonState(true);
      expect(mockSubmitButton.disabled).toBe(true);
    });

    it('should enable submit button', () => {
      formHandler.setSubmitButtonState(false);
      expect(mockSubmitButton.disabled).toBe(false);
    });

    it('should change button text', () => {
      formHandler.setSubmitButtonState(true, 'Processing...');
      expect(mockSubmitButton.textContent).toBe('Processing...');
    });
  });

  describe('Plan Selection', () => {
    it('should select weekly plan', () => {
      formHandler.selectPlan('weekly');
      expect(formHandler.selectedPlan).toBe('weekly');
    });

    it('should select daily plan', () => {
      formHandler.selectPlan('daily');
      expect(formHandler.selectedPlan).toBe('daily');
    });

    it('should throw error for unknown plan', () => {
      expect(() => formHandler.selectPlan('unknown')).toThrow('Unknown plan: unknown');
    });
  });

  describe('Billing Period', () => {
    it('should set billing period to monthly', () => {
      formHandler.setBillingPeriod('monthly');
      expect(formHandler.selectedBillingPeriod).toBe('monthly');
    });

    it('should set billing period to yearly', () => {
      formHandler.setBillingPeriod('yearly');
      expect(formHandler.selectedBillingPeriod).toBe('yearly');
    });

    it('should throw error for invalid billing period', () => {
      expect(() => formHandler.setBillingPeriod('invalid')).toThrow('Invalid billing period: invalid');
    });

    it('should update payment handler billing period', () => {
      formHandler.setBillingPeriod('yearly');
      expect(paymentHandler.stripeClient.setBillingPeriod).toHaveBeenCalledWith('yearly');
    });
  });

  describe('Form State', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should get current form state', () => {
      mockEmailInput.value = 'test@example.com';
      formHandler.selectPlan('weekly');
      formHandler.setBillingPeriod('yearly');

      const state = formHandler.getFormState();

      expect(state.email).toBe('test@example.com');
      expect(state.plan).toBe('weekly');
      expect(state.billingPeriod).toBe('yearly');
      expect(state.isProcessing).toBe(false);
    });

    it('should indicate form is not valid when email is invalid', () => {
      mockEmailInput.value = 'invalid';
      const state = formHandler.getFormState();
      expect(state.isValid).toBe(false);
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
      formHandler.selectPlan('weekly');
    });

    it('should prevent default form submission', async () => {
      const event = new Event('submit');
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      mockEmailInput.value = 'test@example.com';
      paymentHandler.startCheckout.mockResolvedValueOnce({ success: true });

      mockForm.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should reject submission if payment is processing', async () => {
      paymentHandler.isPaymentProcessing.mockReturnValueOnce(true);

      const event = new Event('submit');
      mockForm.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(paymentHandler.startCheckout).not.toHaveBeenCalled();
    });

    it('should show error if email is invalid', async () => {
      mockEmailInput.value = 'invalid';

      const event = new Event('submit');
      mockForm.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockErrorContainer.style.display).toBe('block');
      expect(paymentHandler.startCheckout).not.toHaveBeenCalled();
    });

    it('should show error if no plan selected', async () => {
      const handler = new FormHandler(paymentHandler);
      handler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });

      mockEmailInput.value = 'test@example.com';

      const event = new Event('submit');
      mockForm.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockErrorContainer.style.display).toBe('block');
    });

    it('should call payment handler with correct parameters', async () => {
      mockEmailInput.value = 'test@example.com';
      paymentHandler.startCheckout.mockResolvedValueOnce({ success: true });

      const event = new Event('submit');
      mockForm.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(paymentHandler.startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          plan: 'weekly',
          billingPeriod: 'monthly',
        })
      );
    });
  });

  describe('Success Handler', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should display success message on successful payment', () => {
      const result = {
        email: 'test@example.com',
        subscriptionId: 'sub_123',
      };

      formHandler.handleSuccess(result);

      expect(mockSuccessContainer.style.display).toBe('block');
      expect(mockSuccessContainer.textContent).toContain('Welcome');
    });

    it('should reset form on success', () => {
      mockEmailInput.value = 'test@example.com';
      mockForm.innerHTML = '<input type="hidden" value="test">';

      const resetSpy = jest.spyOn(mockForm, 'reset');
      formHandler.handleSuccess({ email: 'test@example.com' });

      expect(resetSpy).toHaveBeenCalled();
    });

    it('should dispatch success event', () => {
      const eventSpy = jest.fn();
      window.addEventListener('signupSuccess', eventSpy);

      const result = {
        email: 'test@example.com',
        subscriptionId: 'sub_123',
      };

      formHandler.handleSuccess(result);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: result,
        })
      );

      window.removeEventListener('signupSuccess', eventSpy);
    });
  });

  describe('Error Handler', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should display error message on failure', () => {
      const error = new Error('Payment failed');
      formHandler.handleError(error);

      expect(mockErrorContainer.style.display).toBe('block');
      expect(mockErrorContainer.textContent).toContain('Payment failed');
    });

    it('should dispatch error event', () => {
      const eventSpy = jest.fn();
      window.addEventListener('signupError', eventSpy);

      const error = new Error('Card declined');
      error.code = 'card_declined';
      formHandler.handleError(error);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            error: 'Card declined',
            code: 'card_declined',
          }),
        })
      );

      window.removeEventListener('signupError', eventSpy);
    });

    it('should use default error message', () => {
      const error = new Error();
      formHandler.handleError(error);

      expect(mockErrorContainer.textContent).toContain('Payment processing failed');
    });
  });

  describe('Reset', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should reset form to initial state', () => {
      mockEmailInput.value = 'test@example.com';
      formHandler.selectPlan('weekly');
      formHandler.setBillingPeriod('yearly');
      formHandler.showError('Error');
      formHandler.showSuccess('Success');

      formHandler.reset();

      expect(mockEmailInput.value).toBe('');
      expect(formHandler.selectedPlan).toBe(null);
      expect(formHandler.selectedBillingPeriod).toBe('monthly');
      expect(mockErrorContainer.style.display).toBe('none');
      expect(mockSuccessContainer.style.display).toBe('none');
    });

    it('should reset form validity', () => {
      formHandler.isFormValid = true;
      formHandler.reset();
      expect(formHandler.isFormValid).toBe(false);
    });
  });

  describe('Destroy', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should clean up resources', () => {
      formHandler.destroy();

      expect(formHandler.formElement).toBe(null);
      expect(formHandler.emailInput).toBe(null);
      expect(formHandler.submitButton).toBe(null);
      expect(formHandler.errorContainer).toBe(null);
      expect(formHandler.successContainer).toBe(null);
    });
  });

  describe('HTML Escaping', () => {
    beforeEach(() => {
      formHandler.init({
        formSelector: '#test-form',
        emailSelector: '#test-email',
        submitSelector: '#test-submit',
        errorSelector: '#test-error',
        successSelector: '#test-success',
      });
    });

    it('should escape HTML special characters', () => {
      const escaped = formHandler.escapeHtml('<div>"test"</div>');
      expect(escaped).not.toContain('<div>');
      expect(escaped).toContain('&lt;');
    });

    it('should prevent XSS in error messages', () => {
      const xssAttempt = '<img src=x onerror="alert(1)">';
      formHandler.showError(xssAttempt);
      expect(mockErrorContainer.innerHTML).not.toContain('<img');
    });

    it('should prevent XSS in success messages', () => {
      const xssAttempt = '<script>alert(1)</script>';
      formHandler.showSuccess(xssAttempt);
      expect(mockSuccessContainer.innerHTML).not.toContain('<script>');
    });
  });
});
