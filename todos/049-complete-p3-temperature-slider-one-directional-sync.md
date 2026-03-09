---
status: complete
priority: p3
issue_id: "049"
tags: [code-review, agent-native, ui]
dependencies: []
---

# Temperature slider sync is one-directional (UI to model only)

## Problem Statement

The temperature slider updates `environment.temperature` when dragged, but programmatic changes (e.g., `window.cellApp.environment.temperature = 500`) do not update the slider or the `#temperatureValue` display. A Playwright test or console user sees stale UI values.

## Findings

- **Source: Agent-Native Reviewer**
- `src/main.js` lines 135-141: slider→model sync only
- Speed slider has the same limitation (pre-existing pattern)

## Proposed Solutions

### Option A: Add App.setTemperature() method
- **Effort:** Small

```javascript
setTemperature(temp) {
    temp = Math.max(1, Math.min(600, temp));
    this.environment.temperature = temp;
    const slider = document.getElementById('temperatureSlider');
    const label = document.getElementById('temperatureValue');
    if (slider) slider.value = temp;
    if (label) label.textContent = `${temp}K`;
}
```

### Option B: Leave as-is (consistent with speed slider)
- **Effort:** None
- The speed slider has the same limitation — this is a pre-existing pattern

## Acceptance Criteria

- [ ] Programmatic temperature changes reflect in the slider UI
- [ ] Or: documented as a known limitation consistent with speed slider

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-02 | Created from code review | Agent-native reviewer flagged bidirectional sync gap |
