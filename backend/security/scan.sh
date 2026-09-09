#!/bin/bash

# Sathapana Lucky Draw Platform - Security Scanning Script
# Run this script to perform comprehensive security scans

set -e

echo "🔒 Starting Security Scan for Sathapana Lucky Draw Platform"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create security directory if it doesn't exist
mkdir -p security/reports

# ==================== NPM AUDIT ====================
echo -e "\n${YELLOW}1. Running npm audit...${NC}"
cd backend
npm audit --audit-level=high 2>&1 | tee ../security/reports/npm-audit-backend.txt || true
cd ../frontend
npm audit --audit-level=high 2>&1 | tee ../security/reports/npm-audit-frontend.txt || true
cd ..
echo -e "${GREEN}✓ npm audit completed${NC}"

# ==================== ESLINT SECURITY ====================
echo -e "\n${YELLOW}2. Running ESLint security scan...${NC}"
cd backend
npx eslint --plugin security --rule 'security/*: warn' src/ 2>&1 | tee ../security/reports/eslint-security.txt || true
cd ..
echo -e "${GREEN}✓ ESLint security scan completed${NC}"

# ==================== TRIVY FILESYSTEM SCAN ====================
echo -e "\n${YELLOW}3. Running Trivy filesystem scan...${NC}"
if command -v trivy &> /dev/null; then
    trivy fs --severity HIGH,CRITICAL backend/ 2>&1 | tee security/reports/trivy-backend.txt || true
    trivy fs --severity HIGH,CRITICAL frontend/ 2>&1 | tee security/reports/trivy-frontend.txt || true
    echo -e "${GREEN}✓ Trivy filesystem scan completed${NC}"
else
    echo -e "${YELLOW}⚠ Trivy not installed. Install with: brew install trivy${NC}"
fi

# ==================== DOCKER BUILD & SCAN ====================
echo -e "\n${YELLOW}4. Building and scanning Docker images...${NC}"
if command -v docker &> /dev/null; then
    # Build images
    docker build -t sathapana-backend:scan ./backend
    docker build -t sathapana-frontend:scan ./frontend
    
    # Scan images
    if command -v trivy &> /dev/null; then
        trivy image --severity HIGH,CRITICAL sathapana-backend:scan 2>&1 | tee security/reports/trivy-backend-image.txt || true
        trivy image --severity HIGH,CRITICAL sathapana-frontend:scan 2>&1 | tee security/reports/trivy-frontend-image.txt || true
    fi
    
    echo -e "${GREEN}✓ Docker image scan completed${NC}"
else
    echo -e "${YELLOW}⚠ Docker not installed${NC}"
fi

# ==================== OWASP ZAP SCAN ====================
echo -e "\n${YELLOW}5. Running OWASP ZAP scan...${NC}"
if command -v docker &> /dev/null && docker ps | grep -q "zap"; then
    docker run --rm \
        -v $(pwd)/backend/security:/zap/wrk/:rw \
        owasp/zap2docker-stable \
        zap-full-scan.py \
        -t http://localhost:3000 \
        -c /zap/wrk/owasp-zap.yml \
        -r security/reports/zap-report.html
    echo -e "${GREEN}✓ OWASP ZAP scan completed${NC}"
else
    echo -e "${YELLOW}⚠ OWASP ZAP not running. Start with: docker run -p 8080:8080 owasp/zap2docker-stable${NC}"
fi

# ==================== SECRETS SCANNING ====================
echo -e "\n${YELLOW}6. Running secrets scanning...${NC}"
if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --report-format json --report-path security/reports/gitleaks-report.json || true
    echo -e "${GREEN}✓ Secrets scanning completed${NC}"
else
    echo -e "${YELLOW}⚠ gitleaks not installed. Install with: brew install gitleaks${NC}"
fi

# ==================== GENERATE SUMMARY ====================
echo -e "\n${YELLOW}7. Generating security summary...${NC}"

cat > security/reports/security-summary.md << EOF
# Security Scan Summary - $(date)

## Scan Results

### npm audit
- Backend: See npm-audit-backend.txt
- Frontend: See npm-audit-frontend.txt

### ESLint Security
- See eslint-security.txt

### Trivy Filesystem Scan
- Backend: See trivy-backend.txt
- Frontend: See trivy-frontend.txt

### Docker Image Scan
- Backend: See trivy-backend-image.txt
- Frontend: See trivy-frontend-image.txt

### OWASP ZAP
- See zap-report.html

### Secrets Scanning
- See gitleaks-report.json

## Recommendations

1. Fix all CRITICAL and HIGH severity vulnerabilities
2. Address ESLint security warnings
3. Review OWASP ZAP findings
4. Ensure no secrets in codebase
5. Update vulnerable dependencies

## Next Steps

1. Run \`npm audit fix\` to fix automatically fixable issues
2. Review and manually fix remaining issues
3. Re-run security scan to verify fixes
EOF

echo -e "${GREEN}✓ Security summary generated${NC}"

# ==================== DISPLAY RESULTS ====================
echo -e "\n============================================================"
echo -e "${GREEN}🔒 Security Scan Complete!${NC}"
echo "============================================================"
echo -e "\nReports saved to: security/reports/"
echo -e "\nTo view reports:"
echo "  - npm audit: cat security/reports/npm-audit-*.txt"
echo "  - ESLint: cat security/reports/eslint-security.txt"
echo "  - Trivy: cat security/reports/trivy-*.txt"
echo "  - ZAP: open security/reports/zap-report.html"
echo -e "\nTo fix npm vulnerabilities:"
echo "  cd backend && npm audit fix"
echo "  cd frontend && npm audit fix"
