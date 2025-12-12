## Description
<!-- Provide a clear description of the changes -->



## Related Issue
<!-- Link to the issue this PR addresses -->
Closes #XXXX

## Type of Change
<!-- Mark the relevant option with an 'x' -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Security fix
- [ ] Performance improvement
- [ ] CI/CD change

## Changes Made
<!-- List the key changes -->
- 
- 
- 

## Testing
<!-- Describe the tests you ran -->

### Tests Added
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] No tests needed (documentation only)

### Test Results
```
# Paste test results here
npm test

```

### Manual Testing
<!-- Describe manual testing performed -->
- [ ] Tested locally
- [ ] Tested all edge cases
- [ ] Tested error scenarios

## Security Checklist
<!-- ALL items must be checked before merging -->

- [ ] **No secrets committed** (API keys, passwords, tokens)
- [ ] **Input validation** added for all user inputs (Zod schemas)
- [ ] **Authorization checks** in place for protected resources
- [ ] **Audit logging** added for state changes
- [ ] **SQL injection** prevented (using ORM/parameterized queries)
- [ ] **XSS prevention** verified (if UI changes)
- [ ] **CSRF protection** in place (if cookie auth)
- [ ] **Error messages** don't leak sensitive information
- [ ] **Dependencies** scanned (`npm audit` clean or issues documented)
- [ ] **Rate limiting** considered for sensitive endpoints

## Database Changes

- [ ] **No database changes** in this PR

OR

- [ ] **Migration files** created and tested
- [ ] **Migration up** tested successfully
- [ ] **Migration down** (rollback) tested successfully
- [ ] **Indexes** added for new query patterns
- [ ] **Constraints** properly defined (NOT NULL, CHECK, etc.)
- [ ] **RLS policies** updated (if using Supabase)
- [ ] **Data model documentation** updated

## Code Quality

- [ ] **Linter** passing (`npm run lint`)
- [ ] **Type checking** passing (`npm run typecheck`)
- [ ] **Code formatting** applied (`npm run format`)
- [ ] **No console.log** statements (use proper logger)
- [ ] **No commented-out code** (unless with explanation)
- [ ] **No TODOs** without issue numbers
- [ ] **Follow existing patterns** in the codebase

## Documentation

- [ ] **No documentation needed** for this change

OR

- [ ] **README** updated (if setup/usage changed)
- [ ] **API docs** updated (if endpoints changed)
- [ ] **Architecture docs** updated (if design changed)
- [ ] **Security docs** updated (if auth/authZ changed)
- [ ] **Code comments** added for complex logic
- [ ] **JSDoc** added for public APIs

## Breaking Changes

- [ ] **No breaking changes**

OR

- [ ] **Migration guide** provided
- [ ] **Deprecation warnings** added
- [ ] **Version bump** documented

## Performance Impact

- [ ] **No performance impact**
- [ ] **Performance improvement** (describe below)
- [ ] **Potential performance regression** (justified below)

<!-- If performance impact, describe: -->


## Deployment Notes

- [ ] **No special deployment steps** needed

OR

- [ ] **Environment variables** added/changed (update `.env.example`)
- [ ] **Dependencies** added (run `npm install`)
- [ ] **Database migrations** to run
- [ ] **Configuration changes** needed
- [ ] **Feature flags** to enable/disable

### Deployment Checklist
<!-- If special steps needed -->
1. 
2. 
3. 

## Rollback Plan

<!-- How to rollback if something goes wrong -->
1. Revert this PR: `git revert <commit-sha>`
2. Rollback migrations: `npm run db:migrate:rollback`
3. 

## Screenshots
<!-- If applicable, add screenshots of UI changes -->



## Additional Context
<!-- Any other context, concerns, or notes -->



---

## Reviewer Checklist
<!-- For reviewers -->

- [ ] Code changes align with issue requirements
- [ ] Security checklist fully completed
- [ ] Tests are comprehensive and passing
- [ ] Documentation is clear and complete
- [ ] No obvious security vulnerabilities
- [ ] Database migrations are safe
- [ ] Error handling is appropriate
- [ ] Code follows project conventions
- [ ] Performance impact is acceptable
- [ ] Ready to merge

## Pre-Merge Checklist
<!-- Final verification before merge -->

- [ ] All CI checks passing
- [ ] All conversations resolved
- [ ] Security checklist completed
- [ ] Documentation updated
- [ ] Issue file marked as complete
- [ ] Branch is up to date with base branch
