describe('Draw Execution', () => {
  beforeEach(() => {
    cy.clearAuth();
    cy.loginAsAdmin();
  });

  describe('Draw Management', () => {
    it('should display draw page', () => {
      cy.visit('/admin/draws');
      
      // Should show draw management interface
      cy.get('[data-testid="draw-management"], .draw-section')
        .should('be.visible');
      
      // Should show available campaigns
      cy.get('[data-testid="campaign-select"], select[name="campaign"]')
        .should('be.visible');
    });

    it('should show eligible participants', () => {
      cy.visit('/admin/draws');
      
      // Select campaign
      cy.get('[data-testid="campaign-select"], select[name="campaign"]')
        .select('campaign-1');
      
      // Click load participants
      cy.get('[data-testid="load-participants"], button:contains("Load")')
        .click();
      
      // Should show participant list
      cy.get('[data-testid="participant-list"], .participant-table')
        .should('be.visible');
      
      // Should show participant count
      cy.get('[data-testid="participant-count"]')
        .should('contain', 'participants');
    });

    it('should execute draw', () => {
      cy.visit('/admin/draws');
      
      // Select campaign
      cy.get('[data-testid="campaign-select"], select[name="campaign"]')
        .select('campaign-1');
      
      // Set number of winners
      cy.get('input[name="numberOfWinners"]')
        .clear()
        .type('3');
      
      // Set number of alternates
      cy.get('input[name="numberOfAlternates"]')
        .clear()
        .type('5');
      
      // Click execute draw
      cy.get('[data-testid="execute-draw"], button:contains("Execute Draw")')
        .click();
      
      // Confirm execution
      cy.get('[data-testid="confirm-draw"], button:contains("Confirm")')
        .click();
      
      // Should show success message
      cy.checkToast('Draw executed successfully', 'success');
      
      // Should show results
      cy.get('[data-testid="draw-results"], .draw-results')
        .should('be.visible');
    });

    it('should display draw results', () => {
      cy.visit('/admin/draws');
      
      // Click on results tab/view
      cy.get('[data-testid="results-tab"], a:contains("Results")')
        .click();
      
      // Should show winner list
      cy.get('[data-testid="winner-list"], .winner-table')
        .should('be.visible');
      
      // Should show winner names
      cy.get('[data-testid="winner-name"]')
        .should('have.length.greaterThan', 0);
    });

    it('should verify draw integrity', () => {
      cy.visit('/admin/draws');
      
      // Select a completed draw
      cy.get('[data-testid="draw-row"]')
        .first()
        .click();
      
      // Click verify button
      cy.get('[data-testid="verify-draw"], button:contains("Verify")')
        .click();
      
      // Should show verification result
      cy.get('[data-testid="verification-result"]')
        .should('be.visible')
        .and('contain', 'Verified');
    });
  });

  describe('Winner Management', () => {
    it('should display winners list', () => {
      cy.visit('/admin/winners');
      
      // Should show winners table
      cy.get('[data-testid="winners-table"], .winners-section')
        .should('be.visible');
      
      // Should have winner entries
      cy.get('[data-testid="winner-row"]')
        .should('have.length.greaterThan', 0);
    });

    it('should update winner status', () => {
      cy.visit('/admin/winners');
      
      // Find pending winner
      cy.get('[data-testid="winner-status"]:contains("PENDING")')
        .first()
        .parents('[data-testid="winner-row"]')
        .within(() => {
          cy.get('[data-testid="status-select"], select')
            .select('CONTACTED');
        });
      
      // Should show success
      cy.checkToast('Status updated', 'success');
    });

    it('should promote alternate winner', () => {
      cy.visit('/admin/winners');
      
      // Find winner that needs replacement
      cy.get('[data-testid="winner-row"]:has([data-testid="replace-button"])')
        .first()
        .within(() => {
          cy.get('[data-testid="replace-button"], button:contains("Replace")')
            .click();
        });
      
      // Confirm replacement
      cy.get('[data-testid="confirm-button"], button:contains("Confirm")')
        .click();
      
      // Should show success
      cy.checkToast('Alternate winner promoted', 'success');
    });
  });
});
