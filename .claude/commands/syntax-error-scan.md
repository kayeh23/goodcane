---
description: Carry out a deep scan on the entire codebase for syntax, typing, or compilation errors. Report only - do not modify any code.
---

# GoodCane Syntax and Type Check Scan

Carry out a deep scan across the codebase for syntax errors, typing mismatches, and compilation issues.

**Hard rule:** Produce a report only. Do not edit or touch any application code.

## Procedure

1. Run TypeScript compiler type-check:
   ```bash
   npx tsc --noEmit
   ```

2. Run Next.js and ESLint static analysis:
   ```bash
   npm run lint
   ```

3. Validate configuration files:
   - Check `tsconfig.json` paths and compilerOptions.
   - Check `next.config.ts` exports and configurations.
   - Check `package.json` dependencies and script declarations.

4. Compile a concise diagnostic report categorizing any syntax, linting, or type issues found with line numbers and file paths.