<objective>
Analyze and resolve a conceptual inconsistency in Phase 6 of the enhanced molecule intent system plan regarding the definition of "stability" for molecules.

The plan currently has a logical contradiction: it checks `seed.isStable()` before checking geometry, but the regular molecule implementation only marks molecules as "stable" AFTER they've been reshaped to correct geometry. This makes the subsequent geometry check unreachable or the stability concept ambiguous.

Your task is to clarify what "stability" means in this context and update Phase 6 with the correct conceptual framework.
</objective>

<context>
**Plan location:** `C:\Users\iuri\.claude\plans\hidden-petting-snail.md`

**Relevant section:** Phase 6: Rule 7 & Cleanup (Completion with Geometry Check)

**The issue:** Lines 593-603 contain this logic:
```javascript
// Check stability
if (!seed.isStable()) return;

// CRITICAL: Check geometry
if (!seed.geometryVerified && !seed.isReshaping) {
    const template = matchesStableTemplate(seed);
    if (template && needsReshaping(seed, template)) {
        seed.startReshaping(template);
        return; // Wait for reshaping
    }
}
```

**The contradiction:**
- If `isStable()` requires correct geometry (as documented in molecule.js), then line 594 won't pass until geometry is correct, making lines 597-603 unreachable
- If `isStable()` doesn't require geometry, then what stability does it check?

**Project context:** This is a JavaScript particle physics simulation (BioChemSim) where molecules are formed from bonded atoms and must satisfy both chemical (valence) and geometric (spatial) constraints.
</context>

<research>
Before proposing a solution, thoroughly examine these files to understand the current implementation:

1. **Read the molecule.js file** to understand how `isStable()` is currently implemented:
   - Does it check only valence satisfaction?
   - Does it check geometry?
   - Does it use the `geometryVerified` flag?
   - What is the relationship between `isStable()`, `hasValidValence()`, `geometryVerified`, and `isReshaping`?

2. **Read the relevant sections of CLAUDE.md** (lines 62-136) for chemistry rules:
   - What is the documented definition of "stable"?
   - Is there a distinction between "valence stability" and "geometric stability"?

3. **Review AGENTS.md** (lines 364-398 for Bug #10) to understand how the stability system was designed to work:
   - Why was `geometryVerified` added?
   - What problems did it solve?

4. **Read the enhanced plan's Phase 1** to see what `isSeedFor` does:
   - Does seed molecule protection skip `isStable()` checks entirely?
   - How does seed protection interact with stability?
</research>

<analysis_requirements>
After research, analyze the conceptual issue:

1. **Identify the actual behavior** of `isStable()` in the current codebase
2. **Determine the intent** of the Phase 6 code - what should it check and in what order?
3. **Identify the gap** - what's the difference between:
   - Chemical stability (all valences satisfied)
   - Geometric stability (atoms in correct spatial configuration)
   - Complete stability (both chemical AND geometric)
4. **Propose a clear conceptual framework** that resolves the contradiction

Consider these potential solutions:
- Option A: Separate checks - `hasValidValence()` first, then geometry check, then final `isStable()` confirmation
- Option B: Two-phase stability - "chemically stable" vs "geometrically stable" vs "fully stable"
- Option C: Seed molecules use different stability rules than normal molecules
- Option D: Something else based on your analysis
</analysis_requirements>

<output>
After completing your analysis, update the plan file with your resolution:

1. **Add a new subsection** in Phase 6 titled "### Stability Concept Clarification"
   - Explain what stability means in the context of seed molecules
   - Clarify the distinction between valence stability and geometric stability
   - Document which checks happen in which order and why

2. **Update the code example** in Phase 6 (lines 586-617) to:
   - Use the correct stability checks based on your analysis
   - Add inline comments explaining the conceptual framework
   - Ensure the logic is coherent (no unreachable code)

3. **Update the comment** on line 593-594 to be more precise about what stability is being checked

The updated plan should make it crystal clear to implementers:
- What `seed.isStable()` checks (valence only? geometry too? something else?)
- Why we check stability before geometry (if we do)
- How seed molecule stability differs from normal molecule stability (if it does)
</output>

<verification>
Before declaring complete, verify your work:

1. **Logical coherence:** Read through the updated Phase 6 code example - is there any unreachable code? Do the checks make sense in sequence?

2. **Consistency with codebase:** Does your proposed approach match how `isStable()` is actually implemented in molecule.js?

3. **Consistency with chemistry rules:** Does your framework respect the chemistry rules documented in CLAUDE.md?

4. **Clarity:** If a developer reads Phase 6, will they understand exactly what to implement without ambiguity?

5. **Completeness:** Have you addressed both:
   - The conceptual framework (what stability means)
   - The implementation details (what methods to call)
</verification>

<success_criteria>
- The stability concept inconsistency is identified and explained
- A clear conceptual framework is established (valence vs geometric vs complete stability)
- Phase 6 is updated with a new "Stability Concept Clarification" subsection
- The code example in Phase 6 is corrected to use the right stability checks
- The updated logic is coherent, correct, and implementable
- Comments and documentation make the concept clear to future implementers
</success_criteria>

<constraints>
- Do NOT change other phases of the plan - only modify Phase 6
- Do NOT change the overall architecture (separate seed storage, Rule 7 for completion, etc.) - only clarify the stability concept
- Maintain consistency with documented bugs in AGENTS.md - the solution must prevent reshape loops (Bug #9/13)
- Your solution should work with the existing codebase architecture
</constraints>
