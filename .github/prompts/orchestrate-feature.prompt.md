---
description: "Invoke Sysphylier to orchestrate a full feature from intake through release — triggers the full PM → Design → Dev → QA → Documentor pipeline."
---

Route this feature request through the full Sysphylier orchestration pipeline:

## Feature Request

`$FEATURE_DESCRIPTION`

## Orchestration Instructions for Sysphylier

1. **Intake**: Decompose the request into implementation tracks.
2. **PM** — Define scope, acceptance criteria, and out-of-scope boundaries.
3. **Design** — Select a design skill from `awesome-design-skills-main/awesome-design-skills-main/skills/` and produce a UI/UX direction with states and rationale.
4. **Dev** — Implement using the Design skill direction and the frontend baseline at `skills-main/skills-main/skills/frontend-design/SKILL.md`. Route sub-tasks to `frontend`, `backend`, `api`, `database` specialists as needed.
5. **QA** — Validate against PM acceptance criteria and Design intent.
6. **Documentor** — Record scope decisions, design rationale, implementation choices, QA outcome.

## Expected Output

- Dispatch table (agents × tracks)
- Handoff log (one line per agent: input → output → status)
- Gate status (Scope / Design / Tech / Quality / Traceability)
- Final implementation summary
