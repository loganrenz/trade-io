# Threat Model

## Overview

This document identifies potential security threats to Trade.io and defines mitigations for each.

## Assets to Protect

### Critical Assets

1. **User Credentials**: Passwords, session tokens, API keys
2. **Financial Data**: Account balances, transaction history
3. **Personal Information**: Email addresses, names, profiles
4. **Trading Data**: Orders, positions, portfolio values
5. **System Integrity**: Database, application code, infrastructure

### Threat Actors

1. **External Attackers**: Attempting unauthorized access or data theft
2. **Malicious Users**: Legitimate users attempting to exploit the system
3. **Insider Threats**: Compromised admin accounts
4. **Automated Bots**: Scraping, DDoS, credential stuffing

## Threat Analysis

### T1: Unauthorized Account Access

**Description**: Attacker gains access to user account.

**Attack Vectors**:

- Credential stuffing (reused passwords)
- Phishing
- Session hijacking
- Brute force login

**Impact**: HIGH

- Access to user's portfolio
- Ability to place/cancel orders
- View transaction history
- Modify account settings

**Mitigations**:

- ✅ Strong password requirements (min 12 chars, complexity)
- ✅ Rate limiting on login (5 attempts per minute)
- ✅ Email verification required
- ✅ Session expiration (24 hours)
- ✅ Secure session storage (httpOnly cookies or secure JWT)
- 🔄 2FA/MFA (future enhancement)
- 🔄 Anomaly detection (unusual login location/device)

**Residual Risk**: MEDIUM

---

### T2: Privilege Escalation

**Description**: User gains unauthorized elevated privileges.

**Attack Vectors**:

- IDOR (Insecure Direct Object Reference)
- Missing authorization checks
- Role manipulation

**Impact**: HIGH

- Access to other users' accounts
- Ability to perform admin actions
- Data theft or manipulation

**Mitigations**:

- ✅ Authorization checks on every endpoint
- ✅ Resource ownership verification
- ✅ Role-based access control (RBAC)
- ✅ No client-side role enforcement (server-side only)
- ✅ Audit logging of all actions
- ✅ RLS policies (if Supabase) or query-level filters

**Residual Risk**: LOW

---

### T3: SQL Injection

**Description**: Attacker injects malicious SQL via user input.

**Attack Vectors**:

- Unvalidated user input in queries
- String concatenation in SQL
- Vulnerable ORM usage

**Impact**: CRITICAL

- Complete database compromise
- Data theft or deletion
- Privilege escalation

**Mitigations**:

- ✅ ORM usage (Prisma/Drizzle) with parameterized queries
- ✅ Input validation with Zod
- ✅ No raw SQL string concatenation
- ✅ Database user has minimal privileges
- ✅ Code review focusing on database queries

**Residual Risk**: VERY LOW

---

### T4: Cross-Site Scripting (XSS)

**Description**: Attacker injects malicious JavaScript into pages.

**Attack Vectors**:

- Stored XSS (malicious data in database)
- Reflected XSS (malicious data in URL)
- DOM-based XSS

**Impact**: HIGH

- Session token theft
- Phishing
- Malicious actions as victim user

**Mitigations**:

- ✅ Framework auto-escaping (Vue/React)
- ✅ Content Security Policy (CSP) headers
- ✅ Input sanitization for user-generated content
- ✅ httpOnly session cookies (prevent JS access)
- ✅ Validate and sanitize all outputs

**Residual Risk**: LOW

---

### T5: Cross-Site Request Forgery (CSRF)

**Description**: Attacker tricks user into performing unwanted actions.

**Attack Vectors**:

- Malicious links/forms on external sites
- Missing CSRF tokens

**Impact**: MEDIUM

- Unwanted order placement
- Account modifications
- Fund transfers (if implemented)

**Mitigations**:

- ✅ CSRF tokens on state-changing operations
- ✅ SameSite cookie attribute
- ✅ Custom headers (X-Requested-With)
- ✅ Origin/Referer validation
- ✅ Idempotency keys (prevent duplicate actions)

**Residual Risk**: LOW

---

### T6: Insecure Direct Object Reference (IDOR)

**Description**: User accesses another user's resources via ID manipulation.

**Attack Vectors**:

- Predictable IDs in URLs/API calls
- Missing ownership checks

**Impact**: HIGH

- Unauthorized data access
- Data modification or deletion

**Mitigations**:

- ✅ UUIDs instead of sequential IDs (harder to guess)
- ✅ Authorization checks on every resource access
- ✅ Query filters by user/account ownership
- ✅ RLS policies (if Supabase)
- ✅ Audit logging of access attempts

**Residual Risk**: LOW

---

### T7: API Abuse / DDoS

**Description**: Attacker overwhelms system with requests.

**Attack Vectors**:

- High-frequency API calls
- Resource-intensive queries
- Amplification attacks

**Impact**: MEDIUM

- Service degradation or outage
- Increased infrastructure costs

**Mitigations**:

- ✅ Rate limiting per user/IP
- ✅ Request throttling
- ✅ Query complexity limits
- ✅ Pagination required for list endpoints
- 🔄 CDN with DDoS protection (Cloudflare)
- 🔄 Auto-scaling infrastructure

**Residual Risk**: MEDIUM

---

### T8: Sensitive Data Exposure

**Description**: Sensitive information leaked in logs, errors, or API responses.

**Attack Vectors**:

- Verbose error messages
- Logging sensitive data
- Excessive API responses

**Impact**: MEDIUM

- Information disclosure
- Enables further attacks

**Mitigations**:

- ✅ Generic error messages to clients
- ✅ Detailed errors logged server-side only
- ✅ No passwords/tokens in logs
- ✅ Minimal data in API responses
- ✅ PII redaction in logs
- ✅ Secure log storage

**Residual Risk**: LOW

---

### T9: Insecure Dependencies

**Description**: Vulnerable third-party packages.

**Attack Vectors**:

- Known CVEs in dependencies
- Supply chain attacks
- Malicious packages

**Impact**: VARIES (can be CRITICAL)

- Remote code execution
- Data theft
- System compromise

**Mitigations**:

- ✅ npm audit in CI/CD
- ✅ Dependabot alerts enabled
- ✅ Regular dependency updates
- ✅ Lock files committed (package-lock.json)
- ✅ Minimal dependencies (evaluate need)
- 🔄 Automated dependency updates

**Residual Risk**: MEDIUM

---

### T10: Session Hijacking

**Description**: Attacker steals user's session.

**Attack Vectors**:

- XSS to steal session token
- Network sniffing (if HTTP)
- Session fixation

**Impact**: HIGH

- Complete account takeover
- Unauthorized actions as victim

**Mitigations**:

- ✅ HTTPS only (TLS)
- ✅ httpOnly cookies (prevent JS access)
- ✅ Secure cookie attribute
- ✅ SameSite cookie attribute
- ✅ Session expiration
- ✅ Session regeneration on login
- 🔄 IP/user-agent binding (with caution)

**Residual Risk**: LOW

---

### T11: Insufficient Audit Logging

**Description**: Lack of audit trail hinders incident response.

**Attack Vectors**:

- Missing logs for critical actions
- Log tampering
- Insufficient log retention

**Impact**: MEDIUM

- Cannot detect breaches
- Cannot investigate incidents
- Compliance violations

**Mitigations**:

- ✅ Comprehensive audit logging
- ✅ Append-only audit log table
- ✅ Actor attribution for all actions
- ✅ Request correlation IDs
- ✅ Audit log monitoring
- ✅ Long retention (1+ years)

**Residual Risk**: LOW

---

### T12: Market Manipulation (Paper Trading Specific)

**Description**: User exploits paper trading simulation.

**Attack Vectors**:

- Front-running simulated fills
- Exploiting deterministic execution
- Unrealistic profit claims

**Impact**: LOW (no real money)

- Unfair competition advantages
- Misleading performance claims
- Reputational damage

**Mitigations**:

- ✅ Realistic execution simulation (slippage, delays)
- ✅ Market data cannot be predicted in advance
- ✅ Audit trail of all orders/fills
- 🔄 Leaderboard fraud detection
- 🔄 Terms of service prohibiting exploits

**Residual Risk**: MEDIUM

---

### T13: Insider Threats

**Description**: Malicious or compromised admin account.

**Attack Vectors**:

- Admin account compromise
- Malicious employee/contractor
- Privilege abuse

**Impact**: CRITICAL

- Complete system access
- Data theft or manipulation
- Service disruption

**Mitigations**:

- ✅ Audit logging of all admin actions
- ✅ Least privilege for admin accounts
- ✅ Multi-factor authentication for admins (future)
- ✅ Admin action approval workflows (for destructive ops)
- ✅ Regular access reviews
- ✅ Alerting on sensitive admin actions

**Residual Risk**: MEDIUM

---

## Threat Summary Matrix

| ID  | Threat               | Impact   | Likelihood | Residual Risk | Priority |
| --- | -------------------- | -------- | ---------- | ------------- | -------- |
| T1  | Unauthorized Access  | HIGH     | MEDIUM     | MEDIUM        | HIGH     |
| T2  | Privilege Escalation | HIGH     | LOW        | LOW           | HIGH     |
| T3  | SQL Injection        | CRITICAL | LOW        | VERY LOW      | HIGH     |
| T4  | XSS                  | HIGH     | LOW        | LOW           | MEDIUM   |
| T5  | CSRF                 | MEDIUM   | LOW        | LOW           | MEDIUM   |
| T6  | IDOR                 | HIGH     | LOW        | LOW           | HIGH     |
| T7  | API Abuse/DDoS       | MEDIUM   | MEDIUM     | MEDIUM        | MEDIUM   |
| T8  | Data Exposure        | MEDIUM   | LOW        | LOW           | MEDIUM   |
| T9  | Vulnerable Deps      | VARIES   | MEDIUM     | MEDIUM        | HIGH     |
| T10 | Session Hijacking    | HIGH     | LOW        | LOW           | HIGH     |
| T11 | Insufficient Logging | MEDIUM   | LOW        | LOW           | MEDIUM   |
| T12 | Market Manipulation  | LOW      | MEDIUM     | MEDIUM        | LOW      |
| T13 | Insider Threats      | CRITICAL | LOW        | MEDIUM        | HIGH     |

**Legend**:

- ✅ Implemented
- 🔄 Planned/Future
- Impact: CRITICAL > HIGH > MEDIUM > LOW
- Likelihood: HIGH > MEDIUM > LOW
- Priority: HIGH > MEDIUM > LOW

## Security Testing Focus Areas

Based on threat priorities, testing should focus on:

1. **Authentication & Authorization** (T1, T2, T6, T10)
   - Test auth bypass attempts
   - Test IDOR vulnerabilities
   - Test privilege escalation
   - Test session security

2. **Injection Attacks** (T3, T4)
   - SQL injection testing
   - XSS testing (stored, reflected, DOM)
   - Input validation fuzzing

3. **API Security** (T5, T7)
   - CSRF token validation
   - Rate limiting effectiveness
   - Request throttling

4. **Dependency Security** (T9)
   - npm audit in CI
   - Regular security updates
   - Vulnerability scanning

## Continuous Improvement

- Regular threat model reviews (quarterly)
- Penetration testing (annual)
- Security training for developers
- Incident postmortems inform updates
- Security metrics dashboard

---

**Next**: Review [auth.md](./auth.md) for authentication and authorization details.
