describe('Customer Dashboard', () => {
  beforeEach(() => {
    cy.clearAuth();
    cy.loginAsCustomer();
  });

  describe('Dashboard Overview', () => {
    it('should display dashboard with user info', () => {
      cy.visit('/dashboard');
      
      // Should show welcome message
      cy.get('[data-testid="welcome-message"], .welcome-section')
        .should('be.visible');
      
      // Should show user name
      cy.get('[data-testid="user-name"]')
        .should('be.visible');
    });

    it('should show entry summary', () => {
      cy.visit('/dashboard');
      
      // Should show entry stats
      cy.get('[data-testid="entry-summary"], .stats-card')
        .should('be.visible');
      
      // Should show total entries
      cy.get('[data-testid="total-entries"]')
        .should('be.visible');
    });

    it('should show active campaigns', () => {
      cy.visit('/dashboard');
      
      // Should show campaign list
      cy.get('[data-testid="active-campaigns"], .campaigns-section')
        .should('be.visible');
      
      // Should have at least one campaign
      cy.get('[data-testid="campaign-card"]')
        .should('have.length.greaterThan', 0);
    });
  });

  describe('Entry History', () => {
    it('should display entry history', () => {
      cy.visit('/dashboard');
      
      // Click on history tab
      cy.get('[data-testid="history-tab"], a:contains("History")')
        .click();
      
      // Should show entry list
      cy.get('[data-testid="entry-list"], .entry-table')
        .should('be.visible');
    });

    it('should filter entries by campaign', () => {
      cy.visit('/dashboard');
      
      // Click on history tab
      cy.get('[data-testid="history-tab"], a:contains("History")')
        .click();
      
      // Filter by campaign
      cy.get('[data-testid="campaign-filter"], select[name="campaign"]')
        .select('campaign-1');
      
      // Should show filtered entries
      cy.get('[data-testid="entry-item"]')
        .each(($el) => {
          cy.wrap($el).should('contain', 'Smart Savings');
        });
    });

    it('should show entry details', () => {
      cy.visit('/dashboard');
      
      // Click on history tab
      cy.get('[data-testid="history-tab"], a:contains("History")')
        .click();
      
      // Click on an entry
      cy.get('[data-testid="entry-item"]')
        .first()
        .click();
      
      // Should show entry details modal/page
      cy.get('[data-testid="entry-details"], .entry-modal')
        .should('be.visible');
    });
  });

  describe('Campaign Participation', () => {
    it('should join a campaign', () => {
      cy.visit('/campaigns');
      
      // Find joinable campaign
      cy.get('[data-testid="campaign-card"]:has(button:contains("Join"))')
        .first()
        .within(() => {
          cy.get('button:contains("Join")').click();
        });
      
      // Should show success
      cy.checkToast('Successfully joined', 'success');
    });

    it('should view campaign details', () => {
      cy.visit('/campaigns');
      
      // Click on campaign
      cy.get('[data-testid="campaign-card"]')
        .first()
        .within(() => {
          cy.get('a, button:contains("View")').click();
        });
      
      // Should show campaign details
      cy.get('[data-testid="campaign-details"], .campaign-detail')
        .should('be.visible');
    });

    it('should show entry count for joined campaigns', () => {
      cy.visit('/dashboard');
      
      // Should show entry count
      cy.get('[data-testid="entry-count"], .entry-badge')
        .should('be.visible');
    });
  });

  describe('Profile Management', () => {
    it('should view profile', () => {
      cy.visit('/dashboard');
      
      // Click on profile
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="profile-link"], a:contains("Profile")').click();
      
      // Should show profile page
      cy.get('[data-testid="profile-form"], .profile-section')
        .should('be.visible');
    });

    it('should update profile', () => {
      cy.visit('/dashboard');
      
      // Navigate to profile
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="profile-link"], a:contains("Profile")').click();
      
      // Update phone number
      cy.get('input[name="phone"]')
        .clear()
        .type('+855987654321');
      
      // Save changes
      cy.get('button:contains("Save"), button[type="submit"]').click();
      
      // Should show success
      cy.checkToast('Profile updated', 'success');
    });
  });
});
