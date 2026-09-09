describe('Authentication', () => {
  beforeEach(() => {
    cy.clearAuth();
    cy.visit('/');
  });

  describe('Login', () => {
    it('should login successfully with valid credentials', () => {
      cy.visit('/login');
      
      cy.get('input[name="email"], input[type="email"]')
        .type('admin@sathapana.com.kh');
      
      cy.get('input[name="password"], input[type="password"]')
        .type('password123');
      
      cy.get('button[type="submit"]').click();
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      
      // Should show user info
      cy.get('[data-testid="user-menu"]').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/login');
      
      cy.get('input[name="email"], input[type="email"]')
        .type('wrong@email.com');
      
      cy.get('input[name="password"], input[type="password"]')
        .type('wrongpassword');
      
      cy.get('button[type="submit"]').click();
      
      // Should show error message
      cy.checkToast('Invalid credentials', 'error');
      
      // Should stay on login page
      cy.url().should('include', '/login');
    });

    it('should show error for empty fields', () => {
      cy.visit('/login');
      
      cy.get('button[type="submit"]').click();
      
      // Should show validation errors
      cy.get('.error-message, [data-testid="error"]')
        .should('be.visible');
    });

    it('should navigate to register page', () => {
      cy.visit('/login');
      
      cy.get('a[href="/register"], a:contains("Register")')
        .click();
      
      cy.url().should('include', '/register');
    });
  });

  describe('Registration', () => {
    it('should register new user successfully', () => {
      cy.visit('/register');
      
      const testEmail = `test${Date.now()}@test.com`;
      
      cy.get('input[name="email"], input[type="email"]')
        .type(testEmail);
      
      cy.get('input[name="password"], input[type="password"]')
        .first()
        .type('TestPass123!');
      
      cy.get('input[name="confirmPassword"], input[name="password_confirmation"]')
        .type('TestPass123!');
      
      cy.get('input[name="firstName"], input[placeholder*="First"]')
        .type('Test');
      
      cy.get('input[name="lastName"], input[placeholder*="Last"]')
        .type('User');
      
      cy.get('button[type="submit"]').click();
      
      // Should redirect to dashboard after registration
      cy.url().should('include', '/dashboard');
    });

    it('should show error for existing email', () => {
      cy.visit('/register');
      
      cy.get('input[name="email"], input[type="email"]')
        .type('admin@sathapana.com.kh');
      
      cy.get('input[name="password"], input[type="password"]')
        .first()
        .type('TestPass123!');
      
      cy.get('input[name="confirmPassword"], input[name="password_confirmation"]')
        .type('TestPass123!');
      
      cy.get('input[name="firstName"], input[placeholder*="First"]')
        .type('Test');
      
      cy.get('input[name="lastName"], input[placeholder*="Last"]')
        .type('User');
      
      cy.get('button[type="submit"]').click();
      
      // Should show error
      cy.checkToast('already registered', 'error');
    });

    it('should show error for mismatched passwords', () => {
      cy.visit('/register');
      
      cy.get('input[name="email"], input[type="email"]')
        .type('newuser@test.com');
      
      cy.get('input[name="password"], input[type="password"]')
        .first()
        .type('Password1');
      
      cy.get('input[name="confirmPassword"], input[name="password_confirmation"]')
        .type('Password2');
      
      cy.get('button[type="submit"]').click();
      
      // Should show validation error
      cy.get('.error-message, [data-testid="error"]')
        .should('be.visible');
    });
  });

  describe('Logout', () => {
    it('should logout successfully', () => {
      // First login
      cy.loginAsAdmin();
      
      // Click logout
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"], a:contains("Logout")').click();
      
      // Should redirect to login page
      cy.url().should('include', '/login');
      
      // Token should be removed
      cy.window().its('localStorage').invoke('getItem', 'token').should('be.null');
    });
  });
});
