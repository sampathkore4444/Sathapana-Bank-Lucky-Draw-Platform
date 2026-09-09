// ***********************************************
// Custom commands for Sathapana Lucky Draw E2E tests
// ***********************************************

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('input[name="email"], input[type="email"]').type(email);
  cy.get('input[name="password"], input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
});

// Login as admin
Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin@sathapana.com.kh', 'password123');
});

// Login as customer
Cypress.Commands.add('loginAsCustomer', () => {
  cy.login('customer@test.com', 'TestPass123!');
});

// API request with auth
Cypress.Commands.add('apiRequest', (method: string, endpoint: string, body?: any) => {
  const token = localStorage.getItem('token');
  return cy.request({
    method,
    url: `${Cypress.env('API_URL')}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
    failOnStatusCode: false,
  });
});

// Create campaign via API
Cypress.Commands.add('createCampaign', (campaignData: any) => {
  return cy.apiRequest('POST', '/campaigns', campaignData);
});

// Get campaigns via API
Cypress.Commands.add('getCampaigns', () => {
  return cy.apiRequest('GET', '/campaigns');
});

// Delete campaign via API
Cypress.Commands.add('deleteCampaign', (campaignId: string) => {
  return cy.apiRequest('DELETE', `/campaigns/${campaignId}`);
});

// Wait for loading to finish
Cypress.Commands.add('waitForLoad', () => {
  cy.get('[data-testid="loading"]', { timeout: 10000 }).should('not.exist');
});

// Check toast notification
Cypress.Commands.add('checkToast', (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  cy.get(`[data-testid="toast-${type}"]`)
    .should('be.visible')
    .and('contain', message);
});

// Clear all localStorage
Cypress.Commands.add('clearAuth', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
});
