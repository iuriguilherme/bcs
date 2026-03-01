<objective>
Begin implementing the enhanced molecule intent system rewrite plan by orchestrating the work through the /workflows:work command. This enhanced plan incorporates critical architectural fixes, bug mitigations, and performance optimizations identified through research agents.
</objective>

<context>
The enhanced plan is located at: `C:\Users\iuri\.claude\plans\hidden-petting-snail.md`

This plan represents a comprehensive rewrite of the molecule intent system for BioChemSim, with significant enhancements over the original plan including:
- Phase 0: Prerequisite architectural fixes (separate seed molecule storage, context-aware bonding)
- 10 critical bug mitigations from error-detective analysis
- Performance optimizations (spatial query caching)
- Resolved stability concept clarifications in Phase 6
- Comprehensive edge case testing scenarios

The plan is structured in 8 phases (0-7), with Phase 0 being critical prerequisite work that must be completed before other phases can proceed.
</context>

<requirements>
1. **Use the /workflows:work command** - This is imperative to ensure we're in the correct compounding workflow
2. **Reference the "enhanced plan" explicitly** - The command must understand this is the enhanced version with research insights
3. **Start from Phase 0** - Begin with prerequisite architectural fixes (separate seed storage, context-aware bonding)
4. **Follow the phase sequence** - Respect dependencies between phases (Phase 0 → Phase 1 → ... → Phase 7)
5. **Maintain plan fidelity** - Implement exactly what the enhanced plan specifies, including all critical architectural changes
</requirements>

<implementation>
Execute the /workflows:work command with the enhanced plan path:

```
/workflows:work C:\Users\iuri\.claude\plans\hidden-petting-snail.md
```

**Critical Starting Point**: The enhanced plan has a new Phase 0 that was added after research agent analysis. This phase contains prerequisite architectural changes that are essential for the rest of the plan to work correctly:

- Add `seedMolecules` Map to Environment
- Modify `updateMolecules()` to skip seed molecule atoms
- Update `canBondWith()` with context parameter
- Implement context-aware bonding logic

**Why Phase 0 matters**: Without these architectural changes, the seed molecule system will have ID instability issues and bond control problems. Phase 0 must be fully completed and tested before proceeding to Phase 1.

**What to avoid**:
- Do NOT skip Phase 0 to jump straight to Phase 1
- Do NOT modify the plan during execution - follow it as written
- Do NOT bundle multiple phases together unless explicitly allowed by the plan
</implementation>

<workflow_orchestration>
The /workflows:work command will:
1. Load the enhanced plan from the specified path
2. Present the plan structure and ask for confirmation
3. Begin execution starting from Phase 0
4. Track progress through each phase
5. Handle test verification at each phase boundary
6. Manage git commits for completed phases

**Your role**: Ensure the command is invoked correctly and monitor that Phase 0 is the starting point.
</workflow_orchestration>

<success_criteria>
- /workflows:work command successfully invoked with enhanced plan path
- Command recognizes this as the "enhanced plan" (not the original)
- Execution begins at Phase 0 (prerequisite architectural fixes)
- Plan phases are respected in order (0 → 1 → 2 → ... → 7)
</success_criteria>

<verification>
After invoking the command, verify:
- [ ] Command loaded the correct plan file (C:\Users\iuri\.claude\plans\hidden-petting-snail.md)
- [ ] Plan shows Phase 0 as the first phase to execute
- [ ] Command is ready to begin implementation
- [ ] No errors or warnings about plan format or structure
</verification>
