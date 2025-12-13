---
name: Agent Issue
about: Template for agent-executable issues
title: '[ISSUE-XXXX] '
labels: agent-ready
assignees: ''
---

## Status

<!-- Update as work progresses -->

- **Current Status**: READY
- **Assigned Agent**: None
- **Started**: Not started
- **Completed**: Not completed
- **Dependencies**: None

## Goal

<!-- One-sentence description of what this issue accomplishes -->

## Context

<!-- Why this issue matters, how it fits into the larger system -->

## Scope

<!-- What IS included in this issue -->

### Included

-
-
-

### Out of Scope

<!-- What is NOT included (to prevent scope creep) -->

-
-
-

## Prerequisites

<!-- What must be complete before starting this issue -->

- [ ] Issue #XXXX completed
- [ ] Dependencies installed
- [ ] Environment configured

## Implementation Plan

### Step 1: [Description]

<!-- Detailed step-by-step plan -->

**Files to create:**

- `path/to/file.ts`

**Files to modify:**

- `path/to/existing.ts`

**What to do:**

1.
2.
3.

### Step 2: [Description]

**Files to create:**

- **Files to modify:**

- **What to do:**

1.
2.

### Step 3: [Description]

<!-- Testing, documentation, etc. -->

## Files to Create/Modify

### New Files

- [ ] `path/to/new-file.ts` - Description
- [ ] `path/to/another-file.ts` - Description

### Modified Files

- [ ] `path/to/existing.ts` - What changes
- [ ] `path/to/config.ts` - What changes

### Documentation

- [ ] `docs/path/to/doc.md` - What to document

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] All tests passing
- [ ] Linters passing
- [ ] Documentation updated
- [ ] Security checklist completed

## Tests Required

### Unit Tests

- [ ] Test case 1
- [ ] Test case 2
- [ ] Edge case:
- [ ] Error case:

### Integration Tests

- [ ] API test:
- [ ] Database test:

### E2E Tests (if applicable)

- [ ] User flow:

## Security Checklist

- [ ] Input validation with Zod
- [ ] Authorization checks in place
- [ ] No secrets in code
- [ ] Audit logging added
- [ ] SQL injection prevented (using ORM)
- [ ] XSS prevented (if UI changes)
- [ ] Rate limiting considered
- [ ] Error messages don't leak sensitive info

## Security Notes

<!-- Specific security considerations for this issue -->

## Performance Considerations

<!-- Any performance implications to be aware of -->

## Database Changes

### Migrations

- [ ] Migration file: `YYYYMMDDHHMMSS_description.sql`
- [ ] Migration tested (up and down)
- [ ] Indexes added for query patterns

### Schema Changes

```sql
-- If applicable, include schema changes here

```

## API Changes

### New Endpoints

- `POST /api/path` - Description

### Modified Endpoints

- `GET /api/path` - What changed

### Request/Response Schemas

```typescript
// Include Zod schemas or TypeScript types
```

## Environment Variables

### New Variables

```bash
NEW_VAR_NAME=          # Description, default value
```

### Modified Variables

<!-- If any existing vars change -->

## Dependencies

### New Dependencies

```bash
npm install package-name
```

### Why Needed

<!-- Justification for new dependencies -->

## Rollback Plan

<!-- If something goes wrong, how to rollback -->

1. Revert migration: `npm run db:migrate:rollback`
2. Revert code changes: `git revert <commit>`
3.

## Estimated Complexity

<!-- S = Small, M = Medium, L = Large -->

**Size**: M

**Estimated Token Budget**: ~30k tokens

**Time Estimate**: 2-3 hours for experienced developer

## Related Issues

<!-- Link to related issues -->

- Depends on: #XXXX
- Blocks: #YYYY
- Related: #ZZZZ

## Additional Notes

<!-- Any other context, links, or information -->

## Definition of Done

Before marking this issue complete, verify:

- [ ] All acceptance criteria met
- [ ] All tests written and passing
- [ ] Linters passing (`npm run lint`)
- [ ] Type checking passing (`npm run typecheck`)
- [ ] Security checklist completed
- [ ] Documentation updated
- [ ] Database migrations tested (up and down)
- [ ] No secrets committed
- [ ] Code review completed (if applicable)
- [ ] Issue file updated with completion status

---

**Agent Instructions**:

1. Read this entire issue before starting
2. Follow the implementation plan step-by-step
3. Check off items as you complete them
4. Run tests frequently during development
5. Update this issue file with your progress
6. Commit with message: `feat(scope): description - Refs #XXXX`
