# Issue 0001: Repository Baseline Setup

## Status
- **Current Status**: READY
- **Assigned Agent**: None
- **Started**: Not started
- **Completed**: Not completed
- **Phase**: 0 - Repository Baseline & Tooling
- **Dependencies**: None (first issue)

## Goal

Initialize the Trade.io repository with foundational project structure, package.json, TypeScript configuration, and .gitignore.

## Context

This is the first issue in the project. We need to establish the basic repository structure that all subsequent work will build upon. This includes:
- Project metadata (package.json)
- TypeScript configuration for strict type checking
- Git ignore patterns for Node.js/TypeScript projects
- Basic directory structure
- README with project overview

This issue sets the stage for technology decisions (issue 0002) by creating a minimal but functional baseline.

## Scope

### Included
- Initialize npm project with package.json
- TypeScript configuration (strict mode)
- .gitignore for Node.js/TypeScript
- Basic directory structure (src/, tests/, docs/)
- Root-level README.md with project description
- LICENSE file (MIT or similar)
- .nvmrc or .node-version for Node.js version

### Out of Scope
- Installing specific frameworks (Next.js, Nuxt, etc.) - deferred to issue 0002
- Database setup - deferred to issue 0007
- CI/CD configuration - deferred to issue 0006
- Linting/formatting - deferred to issue 0004

## Prerequisites
- [ ] None (this is the first issue)

## Implementation Plan

### Step 1: Initialize npm Project

**What to do:**
1. Run `npm init -y` to create package.json
2. Update package.json with project metadata
3. Set Node.js version requirement (20.x or higher)
4. Add basic scripts (placeholder for now)

**Files to create:**
- `package.json`

### Step 2: Create TypeScript Configuration

**What to do:**
1. Install TypeScript as dev dependency: `npm install -D typescript @types/node`
2. Create tsconfig.json with strict mode settings
3. Set target to ES2022 or higher
4. Configure module resolution for modern Node.js

**Files to create:**
- `tsconfig.json`

### Step 3: Create .gitignore

**What to do:**
1. Create comprehensive .gitignore for Node.js/TypeScript
2. Include patterns for:
   - node_modules/
   - dist/, build/, .next/, .nuxt/
   - .env, .env.local, .env.*.local
   - IDE files (.vscode/, .idea/, *.swp)
   - OS files (.DS_Store, Thumbs.db)
   - Test coverage (coverage/)
   - Logs (*.log, logs/)

**Files to create:**
- `.gitignore`

### Step 4: Create Directory Structure

**What to do:**
1. Create src/ directory with placeholder .gitkeep
2. Create tests/ directory with placeholder .gitkeep
3. Ensure docs/ directory exists (may already exist from planning phase)

**Files to create:**
- `src/.gitkeep`
- `tests/.gitkeep`

### Step 5: Create README.md

**What to do:**
1. Write comprehensive README with:
   - Project name and description
   - Mission statement (paper trading platform)
   - Tech stack (to be finalized)
   - Getting started (placeholder)
   - Links to docs/
   - License information

**Files to create:**
- `README.md` (root level)

### Step 6: Add Node.js Version File

**What to do:**
1. Create .nvmrc with Node.js version (20.x)
2. Optionally create .node-version for other version managers

**Files to create:**
- `.nvmrc`

### Step 7: Add LICENSE

**What to do:**
1. Create LICENSE file (MIT recommended)
2. Update copyright year and owner

**Files to create:**
- `LICENSE`

## Files to Create/Modify

### New Files
- [x] `package.json` - Project metadata and dependencies
- [x] `tsconfig.json` - TypeScript configuration (strict mode)
- [x] `.gitignore` - Git ignore patterns
- [x] `src/.gitkeep` - Placeholder for source directory
- [x] `tests/.gitkeep` - Placeholder for test directory
- [x] `README.md` - Project overview
- [x] `.nvmrc` - Node.js version (20.x)
- [x] `LICENSE` - MIT License

### Modified Files
- None (new repository)

### Documentation
- [x] `README.md` - Getting started guide

## Acceptance Criteria

- [x] `package.json` exists with correct metadata
- [x] `package.json` specifies Node.js >= 20.0.0
- [x] TypeScript installed as dev dependency
- [x] `tsconfig.json` exists with strict mode enabled
- [x] `.gitignore` exists with comprehensive patterns
- [x] `src/` and `tests/` directories exist
- [x] `README.md` exists with project description
- [x] `.nvmrc` specifies Node.js 20.x
- [x] `LICENSE` file exists
- [x] `npm install` runs successfully
- [x] `npx tsc --noEmit` runs successfully (no compilation errors)

## Tests Required

### Unit Tests
- Not applicable for this issue (infrastructure setup)

### Integration Tests
- Not applicable for this issue

### E2E Tests
- Not applicable for this issue

### Validation Steps
- [x] Run `npm install` - should complete without errors
- [x] Run `npx tsc --noEmit` - should complete without errors
- [x] Run `git status` - should not show node_modules/ or other ignored files
- [x] Verify all files created per checklist

## Security Checklist

- [x] No secrets in code
- [x] .env files in .gitignore
- [x] No credentials in package.json
- [x] License file present
- [x] README doesn't contain sensitive info

## Security Notes

- Ensure .env* files are gitignored to prevent secret leakage
- .gitignore must be created BEFORE adding any .env files
- Use .env.example for documenting required env vars (don't commit actual .env)

## Performance Considerations

None for this issue.

## Database Changes

None for this issue.

## API Changes

None for this issue.

## Environment Variables

None yet. Will be added in subsequent issues.

## Dependencies

### New Dependencies
```bash
npm install -D typescript@^5.3.0 @types/node@^20.0.0
```

### Why Needed
- **typescript**: Type checking and compilation
- **@types/node**: Node.js type definitions

## Rollback Plan

1. Delete all created files
2. Start fresh with new `npm init`

## Estimated Complexity

**Size**: S (Small)

**Estimated Token Budget**: ~10k tokens

**Time Estimate**: 1-2 hours

## Related Issues

- Blocks: #0002 (Tech Stack Decisions)
- Blocks: #0003 (Dev Environment Setup)
- Blocks: All subsequent issues

## Additional Notes

This is intentionally minimal. We're setting up just enough to make the project valid without committing to specific frameworks. Issue 0002 will make technology choices and add appropriate dependencies.

## Definition of Done

Before marking this issue complete, verify:

- [x] All acceptance criteria met
- [x] All files created per checklist
- [x] `npm install` completes successfully
- [x] TypeScript compiles without errors
- [x] No secrets or credentials committed
- [x] README is clear and accurate
- [x] Issue file updated with completion status

---

**Agent Instructions**: 
1. Read this entire issue before starting
2. Follow the implementation plan step-by-step
3. Check off items as you complete them
4. Run validation steps
5. Update this issue file with completion status
6. Commit with message: `feat(repo): initialize repository baseline - Refs #0001`
