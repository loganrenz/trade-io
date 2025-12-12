# Issue 0002: Technology Stack Decisions

## Status

- **Current Status**: READY
- **Phase**: 0 - Repository Baseline & Tooling
- **Dependencies**: Issue #0001

## Goal

Finalize technology choices for frontend, backend, database ORM, and auth provider. Document decisions as Architecture Decision Records (ADRs).

## Context

Issue 0001 created a minimal baseline. Now we must choose specific technologies that will be used throughout the project. These decisions are critical and should be well-documented with rationale.

## Scope

### Included

- Choose frontend framework (Nuxt 3 vs Next.js 14)
- Choose backend API pattern (tRPC vs REST with Express/Fastify)
- Choose ORM (Prisma vs Drizzle)
- Choose auth provider (Supabase Auth vs Clerk vs custom JWT)
- Choose database hosting (Supabase vs Neon vs PlanetScale vs local Postgres)
- Document each decision as ADR in docs/architecture/decisions/
- Update package.json with chosen framework/libraries
- Update README with final stack

### Out of Scope

- Actually implementing features with chosen stack
- Full framework setup (deferred to issue 0003)

## Implementation Plan

### Step 1: Research and Compare Options

Review tradeoffs for each technology choice. Consider:

- Type safety
- Developer experience
- Performance
- Community support
- Deployment options
- Cost (hosting)

### Step 2: Make Decisions

Recommended choices (adjust if needed):

- **Frontend**: Nuxt 3 (Vue) - better SSR, simpler than Next
- **Backend**: tRPC - type-safe, no code generation needed
- **ORM**: Prisma - excellent DX, mature ecosystem
- **Auth**: Supabase Auth - integrated with DB hosting, RLS support
- **DB Hosting**: Supabase - includes auth, DB, RLS, generous free tier

### Step 3: Document ADRs

Create ADR files in docs/architecture/decisions/:

- 0001-frontend-framework.md
- 0002-backend-api-pattern.md
- 0003-database-orm.md
- 0004-auth-provider.md
- 0005-database-hosting.md

Each ADR should include:

- Context
- Decision
- Rationale
- Consequences
- Alternatives considered

### Step 4: Update package.json

Install chosen framework/libraries:

```bash
npm install nuxt prisma @prisma/client @trpc/server @trpc/client
npm install -D @nuxt/devtools
```

### Step 5: Update Documentation

Update docs/README.md and root README.md with final stack.

## Files to Create/Modify

### New Files

- [ ] `docs/architecture/decisions/0001-frontend-framework.md`
- [ ] `docs/architecture/decisions/0002-backend-api-pattern.md`
- [ ] `docs/architecture/decisions/0003-database-orm.md`
- [ ] `docs/architecture/decisions/0004-auth-provider.md`
- [ ] `docs/architecture/decisions/0005-database-hosting.md`

### Modified Files

- [ ] `package.json` - Add chosen dependencies
- [ ] `README.md` - Update tech stack section
- [ ] `docs/README.md` - Update tech stack section
- [ ] `docs/architecture/technology-decisions.md` - Link to ADRs

## Acceptance Criteria

- [ ] All 5 ADRs created with clear rationale
- [ ] ADR format consistent (Context, Decision, Rationale, Consequences)
- [ ] Chosen dependencies added to package.json
- [ ] README updated with final tech stack
- [ ] All choices are consistent (e.g., Supabase for both DB and auth)
- [ ] npm install completes successfully

## Tests Required

Not applicable (documentation only)

## Security Checklist

- [ ] No credentials in ADRs
- [ ] Auth provider choice supports security requirements
- [ ] Database hosting supports encryption at rest

## Security Notes

Auth provider must support:

- Email verification
- Password hashing
- Session management
- Rate limiting (or we implement it)

## Estimated Complexity

**Size**: M (Medium)
**Token Budget**: ~25k tokens
**Time Estimate**: 3-5 hours (research + documentation)

## Related Issues

- Depends on: #0001
- Blocks: #0003, #0007

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All ADRs created and reviewed
- [ ] Technology choices are consistent
- [ ] README updated
- [ ] Commit: `docs(arch): document technology stack decisions - Refs #0002`
