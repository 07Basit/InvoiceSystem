---
description: "Ask Design agent to select a design skill and produce a UI direction for a feature — includes state definitions, layout direction, and skill rationale."
---

Design direction needed for: `$FEATURE_OR_SCREEN_NAME`

## Context

- Module: `$MODULE` (e.g., Invoice Management, PDF Editor, Dashboard)
- User story: `$USER_STORY`
- Key screens/components involved: `$SCREENS`

## Design Agent Instructions

1. **Select a primary skill** from `awesome-design-skills-main/awesome-design-skills-main/skills/` that fits this feature's tone and context.
2. **Read the skill file** before producing any direction.
3. **Reference the frontend baseline** at `skills-main/skills-main/skills/frontend-design/SKILL.md` for implementation constraints.
4. **Produce a design direction** that includes:
   - Layout and hierarchy decisions
   - Color, typography, and spacing guidance aligned to the skill
   - Required states: default, loading, empty, error, permission-locked, destructive-confirm (where applicable)
   - Role-based visibility notes
   - 1–2 rejected alternatives with brief tradeoff notes
   - Open implementation risks for Dev

## Output Format

```
## Design — Design Decision
Task ID: [auto]
Date: [today]

### Design Skill Reference
- Primary skill: [skill-name] — path: awesome-design-skills-main/.../[skill-name]/SKILL.md
- Baseline: skills-main/skills-main/skills/frontend-design/SKILL.md

### Design Proposal
...

### States Covered
...

### Alternatives Considered
...

### Implementation Risks for Dev
...
```
