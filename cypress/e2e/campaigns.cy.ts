describe('Campaigns', () => {
  beforeEach(() => {
    cy.clearAuth();
    cy.loginAsAdmin();
  });

  describe('Campaign List', () => {
    it('should display list of campaigns', () => {
      cy.visit('/campaigns');
      
      // Should show campaign list
      cy.get('[data-testid="campaign-list"], .campaign-card')
        .should('be.visible');
      
      // Should have at least one campaign
      cy.get('[data-testid="campaign-item"], .campaign-item')
        .should('have.length.greaterThan', 0);
    });

    it('should filter campaigns by status', () => {
      cy.visit('/campaigns');
      
      // Click status filter
      cy.get('[data-testid="status-filter"], select[name="status"]')
        .select('ACTIVE');
      
      // Should show only active campaigns
      cy.get('[data-testid="campaign-status"]')
        .each(($el) => {
          cy.wrap($el).should('contain', 'ACTIVE');
        });
    });

    it('should search campaigns by name', () => {
      cy.visit('/campaigns');
      
      // Type in search box
      cy.get('[data-testid="search-input"], input[placeholder*="Search"]')
        .type('Smart Savings');
      
      // Should filter results
      cy.get('[data-testid="campaign-name"]')
        .first()
        .should('contain', 'Smart Savings');
    });
  });

  describe('Campaign Details', () => {
    it('should display campaign details', () => {
      cy.visit('/campaigns/campaign-1');
      
      // Should show campaign info
      cy.get('[data-testid="campaign-name"], h1')
        .should('be.visible');
      
      cy.get('[data-testid="campaign-description"]')
        .should('be.visible');
      
      // Should show prizes
      cy.get('[data-testid="prize-list"], .prize-card')
        .should('be.visible');
    });

    it('should show campaign statistics', () => {
      cy.visit('/campaigns/campaign-1');
      
      // Should show stats section
      cy.get('[data-testid="campaign-stats"], .stats-section')
        .should('be.visible');
      
      // Should show entry count
      cy.get('[data-testid="total-entries"]')
        .should('be.visible');
    });

    it('should allow joining campaign', () => {
      cy.visit('/campaigns/campaign-1');
      
      // Click join button
      cy.get('[data-testid="join-button"], button:contains("Join")')
        .click();
      
      // Should show success message
      cy.checkToast('Successfully joined', 'success');
    });
  });

  describe('Campaign Management (Admin)', () => {
    it('should create new campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Click create button
      cy.get('[data-testid="create-campaign"], button:contains("Create")')
        .click();
      
      // Fill in form
      cy.get('input[name="name"]')
        .type('E2E Test Campaign');
      
      cy.get('textarea[name="description"]')
        .type('This is a test campaign created via E2E');
      
      cy.get('input[name="startDate"]')
        .type('2025-01-01');
      
      cy.get('input[name="endDate"]')
        .type('2025-12-31');
      
      cy.get('input[name="drawDate"]')
        .type('2025-12-31');
      
      // Submit form
      cy.get('button[type="submit"]').click();
      
      // Should show success message
      cy.checkToast('Campaign created', 'success');
    });

    it('should activate draft campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Find draft campaign
      cy.get('[data-testid="campaign-status"]:contains("DRAFT")')
        .first()
        .parents('[data-testid="campaign-row"]')
        .within(() => {
          cy.get('[data-testid="activate-button"], button:contains("Activate")')
            .click();
        });
      
      // Confirm activation
      cy.get('[data-testid="confirm-button"], button:contains("Yes")')
        .click();
      
      // Should show success
      cy.checkToast('Campaign activated', 'success');
    });

    it('should pause active campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Find active campaign
      cy.get('[data-testid="campaign-status"]:contains("ACTIVE")')
        .first()
        .parents('[data-testid="campaign-row"]')
        .within(() => {
          cy.get('[data-testid="pause-button"], button:contains("Pause")')
            .click();
        });
      
      // Confirm pause
      cy.get('[data-testid="confirm-button"], button:contains("Yes")')
        .click();
      
      // Should show success
      cy.checkToast('Campaign paused', 'success');
    });

    it('should close campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Find campaign to close
      cy.get('[data-testid="campaign-row"]')
        .first()
        .within(() => {
          cy.get('[data-testid="close-button"], button:contains("Close")')
            .click();
        });
      
      // Confirm closure
      cy.get('[data-testid="confirm-button"], button:contains("Yes")')
        .click();
      
      // Should show success
      cy.checkToast('Campaign closed', 'success');
    });
  });
});
