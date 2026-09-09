describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.clearAuth();
    cy.loginAsAdmin();
  });

  describe('Dashboard Overview', () => {
    it('should display admin dashboard', () => {
      cy.visit('/admin');
      
      // Should show admin dashboard
      cy.get('[data-testid="admin-dashboard"], .admin-section')
        .should('be.visible');
      
      // Should show statistics cards
      cy.get('[data-testid="stats-card"], .stat-card')
        .should('have.length.greaterThan', 0);
    });

    it('should show system statistics', () => {
      cy.visit('/admin');
      
      // Should show total campaigns
      cy.get('[data-testid="total-campaigns"]')
        .should('be.visible');
      
      // Should show total entries
      cy.get('[data-testid="total-entries"]')
        .should('be.visible');
      
      // Should show total winners
      cy.get('[data-testid="total-winners"]')
        .should('be.visible');
    });

    it('should show recent activity', () => {
      cy.visit('/admin');
      
      // Should show activity feed
      cy.get('[data-testid="activity-feed"], .activity-section')
        .should('be.visible');
      
      // Should have activity items
      cy.get('[data-testid="activity-item"]')
        .should('have.length.greaterThan', 0);
    });
  });

  describe('Campaign Management', () => {
    it('should display campaign management page', () => {
      cy.visit('/admin/campaigns');
      
      // Should show campaigns table
      cy.get('[data-testid="campaigns-table"], .campaigns-section')
        .should('be.visible');
      
      // Should have campaign rows
      cy.get('[data-testid="campaign-row"]')
        .should('have.length.greaterThan', 0);
    });

    it('should create new campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Click create button
      cy.get('[data-testid="create-campaign"], button:contains("Create")')
        .click();
      
      // Fill in form
      cy.get('input[name="name"]')
        .type('Admin Test Campaign');
      
      cy.get('textarea[name="description"]')
        .type('Test campaign created by admin');
      
      cy.get('input[name="startDate"]')
        .type('2025-01-01');
      
      cy.get('input[name="endDate"]')
        .type('2025-12-31');
      
      cy.get('input[name="drawDate"]')
        .type('2025-12-31');
      
      // Submit
      cy.get('button[type="submit"]').click();
      
      // Should show success
      cy.checkToast('Campaign created', 'success');
    });

    it('should edit campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Click edit on first campaign
      cy.get('[data-testid="campaign-row"]')
        .first()
        .within(() => {
          cy.get('[data-testid="edit-button"], button:contains("Edit")')
            .click();
        });
      
      // Update name
      cy.get('input[name="name"]')
        .clear()
        .type('Updated Campaign Name');
      
      // Save changes
      cy.get('button:contains("Save"), button[type="submit"]').click();
      
      // Should show success
      cy.checkToast('Campaign updated', 'success');
    });

    it('should delete draft campaign', () => {
      cy.visit('/admin/campaigns');
      
      // Find draft campaign
      cy.get('[data-testid="campaign-status"]:contains("DRAFT")')
        .first()
        .parents('[data-testid="campaign-row"]')
        .within(() => {
          cy.get('[data-testid="delete-button"], button:contains("Delete")')
            .click();
        });
      
      // Confirm deletion
      cy.get('[data-testid="confirm-button"], button:contains("Delete")')
        .click();
      
      // Should show success
      cy.checkToast('Campaign deleted', 'success');
    });
  });

  describe('Reports', () => {
    it('should display reports page', () => {
      cy.visit('/admin/reports');
      
      // Should show reports section
      cy.get('[data-testid="reports-section"], .reports-section')
        .should('be.visible');
    });

    it('should generate campaign report', () => {
      cy.visit('/admin/reports');
      
      // Select report type
      cy.get('[data-testid="report-type"], select[name="reportType"]')
        .select('campaign');
      
      // Select campaign
      cy.get('[data-testid="campaign-select"], select[name="campaign"]')
        .select('campaign-1');
      
      // Click generate
      cy.get('[data-testid="generate-report"], button:contains("Generate")')
        .click();
      
      // Should show report
      cy.get('[data-testid="report-output"], .report-section')
        .should('be.visible');
    });

    it('should export report as CSV', () => {
      cy.visit('/admin/reports');
      
      // Generate report first
      cy.get('[data-testid="report-type"], select[name="reportType"]')
        .select('campaign');
      
      cy.get('[data-testid="generate-report"], button:contains("Generate")')
        .click();
      
      // Click export
      cy.get('[data-testid="export-csv"], button:contains("Export CSV")')
        .click();
      
      // Should trigger download
      cy.readFile('cypress/downloads/report.csv').should('exist');
    });
  });

  describe('User Management', () => {
    it('should display user management page', () => {
      cy.visit('/admin/users');
      
      // Should show users table
      cy.get('[data-testid="users-table"], .users-section')
        .should('be.visible');
      
      // Should have user rows
      cy.get('[data-testid="user-row"]')
        .should('have.length.greaterThan', 0);
    });

    it('should toggle user active status', () => {
      cy.visit('/admin/users');
      
      // Find active user
      cy.get('[data-testid="user-status"]:contains("Active")')
        .first()
        .parents('[data-testid="user-row"]')
        .within(() => {
          cy.get('[data-testid="toggle-status"], input[type="checkbox"]')
            .click();
        });
      
      // Confirm action
      cy.get('[data-testid="confirm-button"], button:contains("Confirm")')
        .click();
      
      // Should show success
      cy.checkToast('User status updated', 'success');
    });
  });
});
