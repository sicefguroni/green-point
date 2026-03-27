## Summary
Ex. Sets up the foundational infrastructure for Synapse, including the Supabase connection, Database Schema with Vector support, and the Next.js Authentication flow.

## Related Issue
Link the issue this PR solves (if any). Remove if none.

## Type of Change
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work)
- [ ] Refactoring (no functional changes, no api changes)
- [ ] Build configuration/Scripts

## Key Changes
- **Feature:** Description.
- Ex. **Database:** Enabled `pgvector` and created `notes` table with RLS policies.
- Ex. **Auth:** Implemented Server Actions for Login/Signup in `apps/next/app/login`.

## How To Test
1. Pull the branch and run `npm install`.
2. Ensure `.env.local` has valid Supabase keys.
3. Run `npx tsx apps/next/scripts/verify-infrastructure.ts` to verify DB connection.
4. Go to `http://localhost:3000/login`.
5. Create a new account and verify you are redirected to `/`.

## Evidence (Before/After)
[Add Screenshots]

## Checklist before requesting a review
- [ ] I have performed a self-review of my code.
- [ ] I have added thorough comments, particularly in hard-to-understand areas.
- [ ] I have added unit tests that prove my fix is effective or that my feature works.
- [ ] New and existing unit tests pass locally with my changes.