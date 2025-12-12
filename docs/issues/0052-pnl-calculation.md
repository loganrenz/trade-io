# Issue 0052: Pnl Calculation

## Status
- **Current Status**: READY
- **Phase**: 5
- **Dependencies**: Previous issues

## Goal
Implement realized and unrealized PnL calculation

## Context
Part of Phase 5. See docs/architecture/ and AGENTS.md for context.

## Implementation Plan
1. Review related architecture docs
2. Implement required functionality  
3. Write comprehensive tests
4. Update API documentation
5. Verify security checklist
6. Commit changes

## Acceptance Criteria
- [ ] Functionality implemented per spec
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Security checklist complete
- [ ] No linter errors

## Security Checklist
- [ ] Input validation with Zod
- [ ] Authorization checks in place
- [ ] No secrets in code
- [ ] Audit logging (if state changes)
- [ ] SQL injection prevented

## Estimated Complexity
**Size**: L
**Token Budget**: ~60k tokens

## Definition of Done
- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Linters passing
- [ ] Security verified
- [ ] Commit: `feat(pnl): implement realized and unrealized pnl calculation - Refs #0052`
