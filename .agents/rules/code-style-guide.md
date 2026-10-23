---
trigger: always_on
---

# Code Style and Project Guidelines

1. **Reusable Components**: The app must always use reusable components. Do not hardcode components like buttons, inputs, modals, or feedback message elements; create or use reusable components in `src/components/` to ensure reusability.

2. **No Emojis**: Never use emojis anywhere in the codebase, UI, markdown, commit messages, or responses.

3. **Documentation**: Always update the documentation (`README.md`, `docs/`, test plans, and documentation pages) with any new feature, API endpoint, or architecture update implemented.

4. **Gather Context**: Ask questions if the context provided is insufficient before making assumptions on business logic, product rules, or partner integrations.

5. **Implementation Plan**: Design an implementation plan before proceeding with major changes or features. Refer to `docs/24_HOUR_SPRINT_PLAN.md` for task allocation and milestones.

6. **Project Scope & PRD**: Reference `README.md`, `docs/WRITEUP.md`, `docs/MEASUREMENT.md`, and `docs/24_HOUR_SPRINT_PLAN.md` as primary sources of truth for GoodCane domain requirements.

7. **Update .env.example**: Always update `.env.example` whenever any new environment variable is added to `.env`.

8. **Project Kind**: Full-stack Next.js 16 (App Router) mobile-first pre-order web application and Batch Desk for GoodCane. Prioritize clean TypeScript typings, modular route handlers in `src/app/api/`, and decoupled service layers in `src/lib/`.

9. **Update Docs for Endpoints**: Whenever a new API endpoint is added or modified, update the documentation in `README.md` and relevant docs with the request/response schema and authentication requirements.

10. **Strict Concurrency & Ownership**: Respect the developer domain boundaries outlined in `docs/24_HOUR_SPRINT_PLAN.md` (Person A: Platform/DB, Person B: Trust/Auth/OTP, Person C: Channels/Payments) to eliminate Git merge conflicts.
