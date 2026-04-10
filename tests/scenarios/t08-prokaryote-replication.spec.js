import { test, expect, pressPlay } from '../fixtures/app.js';

/**
 * T08: Prokaryote self-replication via binary fission.
 *
 * Injects a pre-built prokaryote with 2 ribosomes, full ATP, and age > 100.
 * With 2 ribosomes and synthesisRatePerRibosome = 0.0005, progress advances
 * at 0.001/tick. At simulation speed 10 (dt ≈ 10), that is ~0.01/tick
 * → synthesis completes in ~100 simulation ticks (~1-2 seconds wall-clock).
 *
 * Test validity:
 * - Simulation MUST run (pressPlay called)
 * - Prokaryote injected via page.evaluate (analogous to atomSpawner.zone setup)
 * - Both dev.html and index.html must pass
 */

test('T08: prokaryote divides via binary fission when ribosomes and ATP are sufficient', async ({ page }) => {
    // Inject a scaffold prokaryote with 2 ribosomes, full ATP, age > 100
    const parentId = await page.evaluate(() => {
        // Build minimal polymer stubs (no live atoms — structural descriptors)
        const makePolymer = (type, cellRole) => {
            const p = new window.Polymer([], null, type);
            p.type = type;
            p.cellRole = cellRole;
            return p;
        };

        const membrane = [makePolymer(window.PolymerType.LIPID, 'membrane')];
        const nucleoid = [makePolymer(window.PolymerType.NUCLEIC_ACID, 'genetics')];
        const ribosomes = [
            makePolymer(window.PolymerType.PROTEIN, 'structure'),
            makePolymer(window.PolymerType.PROTEIN, 'structure')
        ];

        const cell = new window.Prokaryote({ membrane, nucleoid, ribosomes });
        cell.age = 200;                         // Well past the 100-tick gate
        cell.cytoplasm.atp = 200;               // Full ATP (above divisionThreshold=150)
        cell.position = new window.Vector2(500, 400);

        window.cellApp.environment.addProkaryote(cell);
        return cell.id;
    });

    expect(parentId).toBeTruthy();

    // Verify initial state: 1 prokaryote, no daughter yet
    const initialCount = await page.evaluate(() =>
        window.cellApp.environment.prokaryotes.size
    );
    expect(initialCount).toBe(1);

    // Start simulation
    await pressPlay(page);

    // Wait for division: prokaryote count should reach 2
    await page.waitForFunction(
        () => window.cellApp.environment.prokaryotes.size >= 2,
        { timeout: 30_000, polling: 200 }
    );

    // --- Assertions ---

    const result = await page.evaluate((pid) => {
        const env = window.cellApp.environment;
        const prokaryotes = Array.from(env.prokaryotes.values());
        const parent = env.prokaryotes.get(pid);

        // Find the daughter (generation > 0)
        const daughter = prokaryotes.find(p => p.id !== pid && p.generation > 0);

        return {
            prokaryoteCount: prokaryotes.length,
            parentAlive: parent ? parent.isAlive : false,
            parentReplicationProgress: parent ? parent.replicationProgress : null,
            parentStage: parent ? parent.replicationStage : null,
            daughterFound: !!daughter,
            daughterGeneration: daughter ? daughter.generation : null,
            daughterMembraneCount: daughter ? daughter.membrane.length : 0,
            daughterNucleoidCount: daughter ? daughter.nucleoid.length : 0,
            daughterIsValid: daughter ? daughter.isValid() : false,
            daughterPositionDiffersFromOrigin:
                daughter ? (Math.abs(daughter.position.x - 500) > 1 || Math.abs(daughter.position.y - 400) > 1) : false
        };
    }, parentId);

    // Parent survived division
    expect(result.parentAlive).toBe(true);

    // Parent replication state was reset
    expect(result.parentReplicationProgress).toBe(0);
    expect(result.parentStage).toBe('idle');

    // Daughter was created
    expect(result.daughterFound).toBe(true);
    expect(result.daughterGeneration).toBe(1);

    // Daughter has polymer structures (cloned from parent)
    expect(result.daughterMembraneCount).toBeGreaterThanOrEqual(1);
    expect(result.daughterNucleoidCount).toBeGreaterThanOrEqual(1);

    // Daughter passes structural validity check
    expect(result.daughterIsValid).toBe(true);

    // Daughter was spawned at a different position (not on top of parent)
    expect(result.daughterPositionDiffersFromOrigin).toBe(true);
});

test('T08b: prokaryote without ribosomes does NOT divide', async ({ page }) => {
    // Inject a prokaryote with NO ribosomes — should stay in 'idle' indefinitely
    await page.evaluate(() => {
        const makePolymer = (type, cellRole) => {
            const p = new window.Polymer([], null, type);
            p.type = type;
            p.cellRole = cellRole;
            return p;
        };

        const cell = new window.Prokaryote({
            membrane: [makePolymer(window.PolymerType.LIPID, 'membrane')],
            nucleoid: [makePolymer(window.PolymerType.NUCLEIC_ACID, 'genetics')],
            ribosomes: []  // No ribosomes
        });
        cell.age = 200;
        cell.cytoplasm.atp = 200;
        cell.position = new window.Vector2(300, 300);

        window.cellApp.environment.addProkaryote(cell);
    });

    await pressPlay(page);

    // Run for a few seconds — the cell should NOT divide
    await page.waitForTimeout(3_000);

    const state = await page.evaluate(() => {
        const prokaryotes = Array.from(window.cellApp.environment.prokaryotes.values());
        const cell = prokaryotes[0];
        return {
            count: prokaryotes.length,
            stage: cell ? cell.replicationStage : null
        };
    });

    // Still only 1 prokaryote (no division without ribosomes)
    expect(state.count).toBe(1);
    // Stage remains idle (never entered synthesizing)
    expect(state.stage).toBe('idle');
});
