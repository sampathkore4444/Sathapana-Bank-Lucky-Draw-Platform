// Import commands.js
import './commands';

// Import cypress testing library
import '@testing-library/cypress/add-commands';

// Ignore uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  return false;
});
