/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Login with email and password
     */
    login(email: string, password: string): Chainable<void>;

    /**
     * Login as admin user
     */
    loginAsAdmin(): Chainable<void>;

    /**
     * Login as customer user
     */
    loginAsCustomer(): Chainable<void>;

    /**
     * Make API request with auth token
     */
    apiRequest(method: string, endpoint: string, body?: any): Chainable<any>;

    /**
     * Create campaign via API
     */
    createCampaign(campaignData: any): Chainable<any>;

    /**
     * Get campaigns via API
     */
    getCampaigns(): Chainable<any>;

    /**
     * Delete campaign via API
     */
    deleteCampaign(campaignId: string): Chainable<any>;

    /**
     * Wait for loading spinner to disappear
     */
    waitForLoad(): Chainable<void>;

    /**
     * Check toast notification
     */
    checkToast(message: string, type?: 'success' | 'error' | 'warning'): Chainable<void>;

    /**
     * Clear authentication from localStorage
     */
    clearAuth(): Chainable<void>;
  }
}
