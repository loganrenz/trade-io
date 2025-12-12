# Issue 0014: Risk Compliance Schema

## Status

- **Current Status**: READY
- **Phase**: 1
- **Dependencies**: Previous issues

## Goal

Create risk_limits, symbol_restrictions tables

## Context

Part of Phase 1. See docs/architecture/ and AGENTS.md for context.

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

**Size**: S
**Token Budget**: ~15k tokens

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Linters passing
- [ ] Security verified
- [ ] Commit: `feat(risk): create risk_limits, symbol_restrictions tables - Refs #0014`
