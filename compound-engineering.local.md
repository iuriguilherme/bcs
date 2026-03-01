---
review_agents:
  - compound-engineering:review:performance-oracle
  - compound-engineering:review:code-simplicity-reviewer
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:architecture-strategist
  - compound-engineering:review:pattern-recognition-specialist
---

# BioChemSim Code Review Context

This is a vanilla JavaScript physics simulation (atoms → molecules → polymers → cells).
No frameworks. No backend. Pure browser-side simulation engine.

## Key conventions
- Physics forces are NOT SI units — they're raw numbers processed through Euler integration
- `repulsionForce`, `attractionForce` etc. must be calibrated against `bounceForce = 100` and `attractionStrength = 20` in environment.js
- All entity IDs are strings from `Utils.generateId()`
- `environment.molecules` and `environment.intentions` are Maps (not arrays)
- `atom.isPhysicsIsolated` = true when `claimedByIntentId` is set — skips inter-particle forces
- Tests use Playwright with headless Chromium; simulation runs at 10× speed inside browser

## Files NOT to flag for deletion
- `docs/plans/` — living plan documents
- `docs/solutions/` — institutional knowledge
- `docs/brainstorms/` — design decision records
