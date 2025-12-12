# For the Next Agent

## Start Here

Use this exact prompt to continue work:

**"Please continue where we left off on the Trade.io project."**

## What Happens Next

1. **Read PROGRESS.md** (mandatory first step)
   - See current status (1/70 issues complete, 1.4%)
   - See next issue to work on: **Issue 0002 - Technology Stack Decisions**
   - Review recent work by previous agents

2. **Read the Next Issue**
   - File: `docs/issues/0002-tech-stack-decisions.md`
   - Goal: Finalize tech stack choices (Nuxt/Next, tRPC/REST, Prisma/Drizzle, etc.)
   - Complexity: Medium (M), ~25k tokens
   - Document decisions as ADRs

3. **Follow AGENTS.md Workflow**
   - Complete the issue step-by-step
   - Write tests if applicable
   - Run linters and type checker
   - Commit with proper message format

4. **UPDATE PROGRESS.MD (MANDATORY)**
   - This is the most important step
   - Mark issue 0002 complete with [x]
   - Update percentages
   - Add your work log entry
   - Point to next issue (0003)
   - See PROGRESS.md for exact format

## Current Status Summary

**Completed**: 
- ✅ Issue 0001 - Repository baseline (package.json, TypeScript, .gitignore, etc.)

**Next Up**:
- 📋 Issue 0002 - Technology Stack Decisions (choose frameworks, document ADRs)

**After That**:
- 📋 Issue 0003 - Development Environment Setup (Docker Compose, local DB)
- 📋 Issue 0004 - Linting and Formatting (ESLint, Prettier)
- ... and 66 more issues through Phase 7

## Key Files to Know

- **PROGRESS.md** - Single source of truth for project status
- **AGENTS.md** - Complete workflow guide
- **docs/issues/** - All 70 issues with detailed plans
- **README.md** - Project overview
- **.github/copilot-instructions.md** - Coding standards

## The Rule

**ALWAYS update PROGRESS.md when you finish work. No exceptions.**

Without updating PROGRESS.md, the next agent won't know where you left off!

---

Good luck! The system is designed to make handoffs seamless. Just follow the workflow and update PROGRESS.md when done.
