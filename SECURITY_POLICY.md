# Security Policy - Sathapana Bank Lucky Draw Platform

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

### Contact
- **Email:** security@sathapana.com.kh
- **Phone:** +855 23 220 220
- **Response Time:** 24-48 hours

### What to Include
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### What to Expect
- Acknowledgment within 24 hours
- Initial assessment within 48 hours
- Regular updates on progress
- Credit for responsible disclosure

---

## Security Measures

### Authentication & Authorization

| Control | Implementation |
|---------|----------------|
| Password Hashing | bcrypt (12 rounds) |
| JWT Tokens | HS256 with 15min expiry |
| Refresh Tokens | 7-day expiry with rotation |
| Rate Limiting | 20 requests/15min on auth |
| Account Lockout | After 5 failed attempts |

### Data Protection

| Control | Implementation |
|---------|----------------|
| Encryption at Rest | AES-256 (database) |
| Encryption in Transit | TLS 1.3 (HTTPS) |
| PII Masking | Partial phone/email display |
| Data Retention | 7 years (regulatory) |
| Backup Encryption | AES-256 |

### API Security

| Control | Implementation |
|---------|----------------|
| Input Validation | Zod schemas |
| SQL Injection | Prisma ORM |
| XSS Protection | CSP headers, sanitization |
| CSRF Protection | SameSite cookies |
| Rate Limiting | Per-endpoint limits |
| Request Size Limit | 1MB max |

### Infrastructure Security

| Control | Implementation |
|---------|----------------|
| WAF | Cloudflare/AWS WAF |
| DDoS Protection | Cloudflare |
| Container Scanning | Trivy |
| Secret Management | AWS Secrets Manager |
| Network Segmentation | VPC, private subnets |

### Monitoring & Logging

| Control | Implementation |
|---------|----------------|
| Security Logging | Winston + ELK |
| Audit Trail | Database audit logs |
| Intrusion Detection | AWS GuardDuty |
| Alerting | PagerDuty/Slack |
| Log Retention | 1 year |

---

## Compliance Requirements

### National Bank of Cambodia (NBC)

- ✅ Transaction audit trail
- ✅ Data retention (7 years)
- ✅ Incident reporting (24h)
- ⬜ Annual penetration testing
- ⬜ Quarterly security reviews

### PCI DSS (if processing cards)

- ⬜ Card data encryption
- ⬜ Access controls
- ⬜ Audit logging
- ⬜ Vulnerability management

### Data Protection Law

- ✅ Consent management
- ✅ Data minimization
- ✅ Right to access
- ⬜ Right to deletion

---

## Security Testing Schedule

| Test Type | Frequency | Tool |
|-----------|-----------|------|
| npm audit | Every build | npm |
| Snyk scan | Every PR | Snyk |
| Trivy scan | Every build | Trivy |
| OWASP ZAP | Weekly | ZAP |
| Penetration test | Quarterly | External |
| Code review | Every PR | Manual |

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 - Critical | Data breach, system compromise | 1 hour |
| P2 - High | Vulnerability actively exploited | 4 hours |
| P3 - Medium | Vulnerability discovered | 24 hours |
| P4 - Low | Minor security issue | 1 week |

### Response Steps

1. **Detection** - Identify and confirm incident
2. **Containment** - Isolate affected systems
3. **Eradication** - Remove threat
4. **Recovery** - Restore systems
5. **Lessons Learned** - Document and improve

---

## Security Checklist for Developers

### Before Committing
- [ ] No hardcoded secrets
- [ ] Input validation in place
- [ ] SQL injection prevented
- [ ] XSS protection enabled
- [ ] Authentication required
- [ ] Authorization verified
- [ ] Error messages sanitized
- [ ] Logs don't contain sensitive data

### Before Deployment
- [ ] npm audit passes
- [ ] Environment variables set
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Security headers set
- [ ] Database encrypted
- [ ] Backups encrypted

---

## Security Tools

| Tool | Purpose | Integration |
|------|---------|-------------|
| npm audit | Dependency vulnerabilities | CI/CD |
| Snyk | Vulnerability scanning | CI/CD |
| Trivy | Container scanning | CI/CD |
| OWASP ZAP | Dynamic security testing | Weekly |
| ESLint Security | Code security analysis | CI/CD |
| Gitleaks | Secrets detection | CI/CD |

---

## Contact

For security inquiries:
- **Security Team:** security@sathapana.com.kh
- **IT Support:** it-support@sathapana.com.kh
- **Emergency:** +855 23 220 220

---

**Last Updated:** 2025-01-09
**Next Review:** 2025-04-09
