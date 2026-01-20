/**
 * Tutorial System
 * Guides new users through the simulation interface
 * Non-blocking: users can interact with the simulation during the tutorial
 * Uses FIXED positions to avoid UI state dependencies
 */

class Tutorial {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.active = false;
        this.balloon = null;
        this.highlightEl = null;
        
        // Fixed position constants (pixels from edges)
        // These avoid overlap with: left panel (280px), right panel (280px), header (60px), status (32px)
        this.POSITIONS = {
            // For highlighting left panel elements - balloon goes to immediate right
            RIGHT_OF_LEFT_PANEL: { left: 300, top: 150 },
            // For highlighting right panel elements - balloon goes to immediate left  
            LEFT_OF_RIGHT_PANEL: { right: 300, top: 150 },
            // For canvas interaction - balloon in bottom-right corner of canvas area
            CANVAS_BOTTOM_RIGHT: { right: 320, bottom: 80 },
            // For header elements - balloon below header in center-left area
            BELOW_HEADER: { left: 400, top: 80 },
            // Below play button specifically (right side of header)
            BELOW_PLAY_BUTTON: { right: 400, top: 80 },
            // Above action buttons at bottom of left panel
            LEFT_PANEL_BOTTOM: { left: 300, bottom: 150 },
            // Center of screen
            CENTER: { center: true }
        };

        // Tutorial steps configuration
        this.steps = [
            // === INTRODUCTION === (Step 1/31)
            {
                id: 'welcome',
                title: 'Welcome to BioChemSim! 🧬',
                content: `Build molecules from atoms and watch chemistry happen!

<strong>This tutorial won't block you</strong> – try things as you learn!

Use <strong>→</strong> key or click <strong>Next</strong> to continue.
Press <strong>Esc</strong> to exit anytime.`,
                target: null,
                fixedPosition: 'CENTER'
            },
            
            // === BASIC ATOM PLACEMENT === (Step 2/31)
            {
                id: 'atoms-palette',
                title: 'Step 1: The Atom Palette',
                content: `These are the elements you can place:

• <strong>H</strong> (Hydrogen) – 1 bond
• <strong>C</strong> (Carbon) – 4 bonds  
• <strong>O</strong> (Oxygen) – 2 bonds
• <strong>N</strong> (Nitrogen) – 3 bonds

<em>Click <strong>H</strong> to select it!</em>`,
                target: '#entityPalette',
                fixedPosition: 'RIGHT_OF_LEFT_PANEL'
            },
            // (Step 3/31)
            {
                id: 'place-atoms',
                title: 'Step 2: Place Atoms on Canvas',
                content: `With H selected, <strong>left-click on the canvas</strong> to place hydrogen atoms.

Place 2-3 hydrogens <strong>close together</strong> (but not overlapping).

<em>Go ahead, try it now!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            // (Step 4/31)
            {
                id: 'start-simulation',
                title: 'Step 3: Nothing Moving? Hit Play! ▶️',
                content: `The simulation starts <strong>paused</strong>.

Click <strong>▶️ Play</strong> to start!

Once running:
• Atoms move and collide
• Close atoms with free bonds will <strong>bond together</strong>
• Two H atoms form H₂ molecule!`,
                target: '#playPauseBtn',
                fixedPosition: 'BELOW_PLAY_BUTTON'
            },
            // (Step 5/31)
            {
                id: 'watch-bonding',
                title: 'Chemistry in Action!',
                content: `Watch your atoms! They bond when:

✅ Close enough to touch
✅ Both have <strong>available bonds</strong>

H has 1 bond, so two H atoms form <strong>H₂</strong>

<em>See lines connecting bonded atoms!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },

            // === SELECT TOOL & INSPECTION === (Step 6/31)
            {
                id: 'select-tool-intro',
                title: 'Inspecting Your Creation',
                content: `Let's learn to inspect what you've made!

Click the <strong>🔍 Select</strong> tool, then click on:
• A <strong>free atom</strong> (not bonded)
• An <strong>atom in a molecule</strong>
• The <strong>bond line</strong> between atoms

<em>Watch what appears in the right panel!</em>`,
                target: '#selectTool',
                fixedPosition: 'RIGHT_OF_LEFT_PANEL'
            },
            // (Step 7/31)
            {
                id: 'inspector-panel',
                title: 'The Inspector Panel',
                content: `When you select something, the <strong>Inspector tab</strong> opens automatically!

• <strong>Free atom</strong> → shows element, position, available bonds
• <strong>Bonded atom</strong> → shows its molecule info too
• <strong>Bond line</strong> → shows connected atoms
• <strong>Molecule</strong> → shows formula, stability, all atoms

<em>Click the Inspector tab to see all details!</em>`,
                target: '[data-tab="inspector"]',
                fixedPosition: 'LEFT_OF_RIGHT_PANEL'
            },
            
            // === VIEW LEVELS === (Step 8/31)
            {
                id: 'levels-intro',
                title: 'View Levels: Different Perspectives',
                content: `The numbered buttons change your <strong>view level</strong>:

• <strong>Level 1</strong> = Individual atoms (current)
• <strong>Level 2</strong> = Molecules as shapes
• <strong>Level 3+</strong> = Larger structures

<em>Click <strong>2</strong> to see Molecule View!</em>`,
                target: '#levelButtons',
                fixedPosition: 'BELOW_HEADER'
            },
            // (Step 9/31)
            {
                id: 'molecule-view-select',
                title: 'Selecting in Molecule View',
                content: `In <strong>Level 2</strong> (Molecule View):

• Click a molecule to select it
• The <strong>Inspector tab opens automatically</strong> with details
• Molecules show as <strong>colored shapes</strong> with formula
• <strong>White glow</strong> = stable molecule

<em>Try clicking your H₂ molecule and check the Inspector!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            // (Step 10/31)
            {
                id: 'palette-changes',
                title: 'The Palette Changes Too!',
                content: `Notice the left palette is different now!

• <strong>Level 1</strong> → Atom palette (H, C, O, N...)
• <strong>Level 2</strong> → Molecule palette (your discoveries!)

When you discover stable molecules, they appear here for placement.

<em>Switch between Level 1 and 2 to see!</em>`,
                target: '#entityPalette',
                fixedPosition: 'RIGHT_OF_LEFT_PANEL'
            },

            // === BUILD WATER WITH RESHAPING === (Step 11/31)
            {
                id: 'build-water',
                title: 'Build Water (H₂O) - Watch Reshaping!',
                content: `Switch to <strong>Level 1</strong> and build water:

1. Select <strong>O</strong> from palette
2. Place <strong>1 oxygen</strong>
3. Select <strong>H</strong>, place <strong>2 hydrogens</strong> nearby
4. Hit <strong>Play</strong> and watch!

<em>Notice how the molecule RESHAPES into proper geometry!</em>`,
                target: '#entityPalette',
                fixedPosition: 'RIGHT_OF_LEFT_PANEL'
            },
            // (Step 12/32)
            {
                id: 'reshaping-explained',
                title: 'Molecule Reshaping',
                content: `When atoms bond into a <strong>known molecule pattern</strong>:

1. Bonds form between nearby atoms
2. The molecule <strong>reshapes</strong> to correct geometry
3. Atoms move to their proper positions
4. The molecule becomes <strong>stable</strong> and glows!

<em>The simulation knows many common molecules and their shapes!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            // (Step 13/32)
            {
                id: 'molecule-colors',
                title: 'Molecule Colors in Level 2',
                content: `In <strong>Molecule View</strong>, colors show status:

• <strong style="color: #4CAF50;">Green glow</strong> = Stable molecule
• <strong style="color: #FFC107;">Yellow</strong> = Unstable (still forming)
• <strong style="color: #2196F3;">Blue</strong> = Currently reshaping

<em>Switch to Level 2 to see your completed H₂O!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },

            // === MOLECULE BLUEPRINTS & INTENTIONS === (Step 14/32)
            {
                id: 'molecule-palette',
                title: 'The Molecule Palette',
                content: `In <strong>Level 2</strong>, the left palette shows your discovered molecules.

<strong>Important:</strong> Unlike atoms, you <strong>cannot place molecules directly!</strong>

These are <strong>blueprints</strong> – clicking one creates an <strong>Intention Zone</strong> instead.

<em>Let's learn what that means...</em>`,
                target: '#entityPalette',
                fixedPosition: 'RIGHT_OF_LEFT_PANEL'
            },
            // (Step 14/31)
            {
                id: 'intentions-intro',
                title: 'What are Intention Zones?',
                content: `An <strong>Intention Zone</strong> is a target area that guides chemistry:

• Appears as a <strong>glowing circle</strong> on canvas
• Represents your <strong>goal</strong>: form this molecule here
• The simulation creates <strong>conditions</strong> for formation

<em>It simulates an environment favorable for that molecule!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            // (Step 15/31)
            {
                id: 'intentions-attract',
                title: 'Intention Zone: Attraction',
                content: `Inside an intention zone:

✅ <strong>Needed atoms</strong> are attracted inward
✅ <strong>Matching unstable molecules</strong> can transform
✅ Atoms bond naturally when conditions are right

<em>Like a magnet for the right ingredients!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            // (Step 16/31)
            {
                id: 'intentions-repel',
                title: 'Intention Zone: Repulsion',
                content: `The zone also pushes away interference:

❌ <strong>Unrelated free atoms</strong> are pushed out
❌ <strong>Stable molecules</strong> that can't contribute are repelled
⚡ <strong>Unstable molecules</strong> may break apart to free useful atoms

<em>It clears the way for your target molecule!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            // (Step 17/31)
            {
                id: 'intentions-complete',
                title: 'Intention Zone: Completion',
                content: `When your target molecule forms:

✨ The intention zone <strong>completes</strong> and disappears
✨ The molecule is now <strong>stable</strong>
✨ It gets added to your <strong>Catalogue</strong>!

<em>The simulation creates conditions, chemistry does the rest!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },

            // === TOOLS === (Step 18/31)
            {
                id: 'tools-overview',
                title: 'The Three Tools',
                content: `Three ways to interact:

• <strong>🔍 Select</strong> – Click to inspect entities
• <strong>➕ Place</strong> – Add atoms or set intentions
• <strong>🗑️ Delete</strong> – Remove entities

<em>You've already used Select. Place is active when you pick from palette.</em>`,
                target: '#selectTool',
                fixedPosition: 'RIGHT_OF_LEFT_PANEL'
            },
            // (Step 19/31)
            {
                id: 'right-click-tip',
                title: 'Pro Tip: Right-Click!',
                content: `<strong>Right-click on canvas</strong> anytime to:

• Cancel current placement mode
• Switch back to <strong>Select</strong> tool
• Stop any ongoing action

<em>Super useful! Try it now.</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },

            // === CATALOGUE === (Step 20/31)
            {
                id: 'catalogue-intro',
                title: 'The Catalogue Tab',
                content: `The <strong>Catalogue</strong> in the right panel stores discoveries:

• Every <strong>stable molecule</strong> you create is saved
• Click to see molecule details
• Use it as a reference for what you've made!

<em>Click the Catalogue tab to explore!</em>`,
                target: '[data-tab="catalogue"]',
                fixedPosition: 'LEFT_OF_RIGHT_PANEL'
            },
            // (Step 21/31)
            {
                id: 'catalogue-to-palette',
                title: 'Catalogue & Palette Sync',
                content: `<strong>How it works:</strong>

• Create a stable molecule, and it's added to the Catalogue
• Switch to Level 2, and the Palette shows catalogued molecules
• The palette updates when you enter Level 2

<em>Your discoveries become placeable blueprints!</em>`,
                target: '#levelButtons',
                fixedPosition: 'BELOW_HEADER'
            },

            // === SIMULATION CONTROLS === (Step 22/31)
            {
                id: 'sim-controls',
                title: 'Simulation Controls',
                content: `Master time itself:

• <strong>▶️/⏸️</strong> – Play or Pause
• <strong>⏭️</strong> – Step one frame (when paused)
• <strong>Slider</strong> – Speed control

<em>Pause to place atoms precisely!</em>`,
                target: '.sim-controls',
                fixedPosition: 'BELOW_PLAY_BUTTON'
            },
            // (Step 23/31)
            {
                id: 'canvas-nav',
                title: 'Canvas Navigation',
                content: `Move around your simulation:

• <strong>Scroll wheel</strong> – Zoom in/out
• <strong>Right-click + drag</strong> – Pan around

Works at any view level!

<em>Try zooming in on your molecules!</em>`,
                target: null,
                fixedPosition: 'LEFT_PANEL_BOTTOM'
            },
            
            // === ATOM SPAWNER === (Step 24/31)
            {
                id: 'spawner-intro',
                title: 'The Atom Spawner',
                content: `For automated experiments, use the <strong>Atom Spawner</strong>!

It continuously generates atoms in a zone.

<strong>⚠️ Configure it BEFORE activating!</strong>

<em>Right-click the ⚛️ button to open settings.</em>`,
                target: '#spawnerBtn',
                fixedPosition: 'BELOW_PLAY_BUTTON'
            },
            // (Step 25/31)
            {
                id: 'spawner-config',
                title: 'Configuring the Spawner',
                content: `<strong>Right-click ⚛️</strong> to configure:

• <strong>Atom types</strong> – Select only what you need!
• <strong>Spawn rate</strong> – Ticks between spawns
• <strong>Zone size</strong> – Drag edges on canvas

<em>Pro tip: Only enable atoms your target molecule needs!</em>`,
                target: '#spawnerBtn',
                fixedPosition: 'BELOW_PLAY_BUTTON'
            },
            // (Step 26/31)
            {
                id: 'spawner-workflow',
                title: 'Spawner + Intentions Workflow',
                content: `<strong>Best workflow for complex molecules:</strong>

1. <strong>Pause</strong> the simulation
2. In Level 2, click a molecule blueprint (creates intention)
3. <strong>Configure spawner</strong> with needed atoms only
4. <strong>Drag spawner zone</strong> over the intention
5. <strong>Activate spawner</strong> (click ⚛️)
6. <strong>Play</strong> and watch chemistry happen!`,
                target: null,
                fixedPosition: 'CENTER'
            },
            // (Step 27/31)
            {
                id: 'spawner-warning',
                title: '⚠️ Remember to Turn Off Spawner!',
                content: `<strong>Always deactivate when done!</strong>

Leaving it on causes:
• Too many atoms = slow simulation
• Unwanted reactions everywhere
• Chaos! 😅

<em>Click ⚛️ again to turn OFF when finished.</em>`,
                target: '#spawnerBtn',
                fixedPosition: 'BELOW_PLAY_BUTTON'
            },

            // === POLYMERS & HIGHER LEVELS === (Step 28/31)
            {
                id: 'polymers-intro',
                title: 'Beyond Molecules: Polymers',
                content: `<strong>Level 3</strong> shows <strong>Polymers</strong> – chains of molecules!

• Polymers form when molecules link together
• Examples: proteins, carbohydrates, nucleic acids
• They're the building blocks of life!

In the <strong>polymer palette</strong> you'll find polymer blueprints that create <strong>polymer intention zones</strong>, just like molecule intentions!

<em>Build enough molecules and watch them chain up!</em>`,
                target: '#levelButtons',
                fixedPosition: 'BELOW_HEADER'
            },
            // (Step 29/31) - Merged from old 29+30
            {
                id: 'higher-levels',
                title: 'Higher Levels of Complexity',
                content: `The simulation models life at many scales:

• <strong>Level 4</strong> – Cells (membranes, organelles)
• <strong>Level 5</strong> – Organisms
• <strong>Level 6</strong> – Populations

<em>Each level has its own emergent behaviors!</em>

<strong>Note:</strong> The cell system is still being developed! 🚧
Current features include basic cell membranes and prokaryote-like structures.`,
                target: '#levelButtons',
                fixedPosition: 'BELOW_HEADER'
            },

            // === SMART UI === (Step 30/31)
            {
                id: 'smart-ui',
                title: 'Smart Interface Shortcuts',
                content: `The UI adapts to help you:

• <strong>Click atom in palette</strong>
  Switches to Level 1, activates Place tool

• <strong>Click molecule blueprint</strong>
  Switches to Level 2, activates Place tool

• <strong>Right-click on canvas</strong>
  Cancels action, returns to Select tool

• <strong>Click on atom/molecule/polymer</strong>
  Opens Inspector tab automatically, changes view level`,
                target: null,
                fixedPosition: 'CENTER'
            },
            
            // === COMPLETION === (Step 31/31)
            {
                id: 'complete',
                title: 'You\'re Ready! 🎉',
                content: `<strong>Molecules to try:</strong>

• <strong>CH₄</strong> (methane): 1 C + 4 H
• <strong>CO₂</strong>: 1 C + 2 O
• <strong>NH₃</strong> (ammonia): 1 N + 3 H
• <strong>C₂H₆</strong> (ethane): 2 C + 6 H

Click <strong>❓</strong> anytime to revisit this tutorial!`,
                target: null,
                fixedPosition: 'CENTER'
            }
        ];

        this._createElements();
        this._checkFirstVisit();
    }

    /**
     * Check if this is the user's first visit
     */
    _checkFirstVisit() {
        const hasSeenTutorial = localStorage.getItem('bcs-tutorial-seen');
        if (!hasSeenTutorial) {
            setTimeout(() => {
                this._showTutorialHint();
            }, 1500);
        }
    }

    /**
     * Show a subtle hint that tutorial is available
     */
    _showTutorialHint() {
        const hint = document.getElementById('tutorialHint');
        if (hint) {
            hint.classList.add('visible');
            setTimeout(() => {
                hint.classList.remove('visible');
            }, 10000);
        }
    }

    /**
     * Create DOM elements for tutorial (non-blocking - no overlay)
     */
    _createElements() {
        // Highlight element (pointer-events: none so it doesn't block)
        this.highlightEl = document.createElement('div');
        this.highlightEl.className = 'tutorial-highlight';
        this.highlightEl.style.display = 'none';
        document.body.appendChild(this.highlightEl);

        // Balloon
        this.balloon = document.createElement('div');
        this.balloon.className = 'tutorial-balloon';
        this.balloon.style.display = 'none';
        this.balloon.innerHTML = `
            <div class="tutorial-balloon-header">
                <span class="tutorial-step-indicator"></span>
                <button class="tutorial-close" title="Close tutorial (Esc)">&times;</button>
            </div>
            <h3 class="tutorial-title"></h3>
            <div class="tutorial-content"></div>
            <div class="tutorial-nav">
                <button class="tutorial-btn tutorial-prev">← Back</button>
                <button class="tutorial-btn tutorial-next">Next →</button>
            </div>
        `;
        document.body.appendChild(this.balloon);

        // Bind events
        this.balloon.querySelector('.tutorial-close').addEventListener('click', () => this.end());
        this.balloon.querySelector('.tutorial-prev').addEventListener('click', () => this.prev());
        this.balloon.querySelector('.tutorial-next').addEventListener('click', () => this.next());

        // Keyboard navigation
        this._keyHandler = (e) => {
            if (!this.active) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key === 'Escape') {
                e.preventDefault();
                this.end();
            }
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                this.next();
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prev();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    /**
     * Start the tutorial
     */
    start() {
        this.active = true;
        this.currentStep = 0;
        this.balloon.style.display = 'block';
        
        localStorage.setItem('bcs-tutorial-seen', 'true');
        
        const hint = document.getElementById('tutorialHint');
        if (hint) hint.classList.remove('visible');

        const btn = document.getElementById('tutorialBtn');
        if (btn) btn.classList.add('active');

        this._showStep();
    }

    /**
     * End the tutorial
     */
    end() {
        this.active = false;
        this.balloon.style.display = 'none';
        this.highlightEl.style.display = 'none';
        
        const btn = document.getElementById('tutorialBtn');
        if (btn) btn.classList.remove('active');
    }

    /**
     * Go to next step
     */
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this._showStep();
        } else {
            this.end();
        }
    }

    /**
     * Go to previous step
     */
    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this._showStep();
        }
    }

    /**
     * Show current step
     */
    _showStep() {
        const step = this.steps[this.currentStep];
        
        // Update content
        this.balloon.querySelector('.tutorial-step-indicator').textContent = 
            `${this.currentStep + 1} / ${this.steps.length}`;
        this.balloon.querySelector('.tutorial-title').textContent = step.title;
        this.balloon.querySelector('.tutorial-content').innerHTML = step.content;

        // Update nav buttons
        const prevBtn = this.balloon.querySelector('.tutorial-prev');
        const nextBtn = this.balloon.querySelector('.tutorial-next');
        
        prevBtn.style.visibility = this.currentStep === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Finish ✓' : 'Next →';

        // Position balloon and highlight
        this._positionBalloon(step);
    }

    /**
     * Position the balloon using FIXED positions (independent of UI state)
     */
    _positionBalloon(step) {
        const balloon = this.balloon;
        const highlight = this.highlightEl;
        
        // Reset all position styles
        balloon.style.top = '';
        balloon.style.left = '';
        balloon.style.right = '';
        balloon.style.bottom = '';
        balloon.style.transform = '';
        balloon.className = 'tutorial-balloon';

        // Handle target highlighting (if any)
        if (step.target) {
            const targetEl = document.querySelector(step.target);
            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const padding = 8;
                highlight.style.display = 'block';
                highlight.style.top = `${rect.top - padding}px`;
                highlight.style.left = `${rect.left - padding}px`;
                highlight.style.width = `${rect.width + padding * 2}px`;
                highlight.style.height = `${rect.height + padding * 2}px`;
            } else {
                highlight.style.display = 'none';
            }
        } else {
            highlight.style.display = 'none';
        }

        // Apply FIXED position (independent of target/UI state)
        const pos = this.POSITIONS[step.fixedPosition] || this.POSITIONS.CENTER;
        
        if (pos.center) {
            balloon.classList.add('position-center');
            return;
        }

        if (pos.top !== undefined) balloon.style.top = `${pos.top}px`;
        if (pos.bottom !== undefined) balloon.style.bottom = `${pos.bottom}px`;
        if (pos.left !== undefined) balloon.style.left = `${pos.left}px`;
        if (pos.right !== undefined) balloon.style.right = `${pos.right}px`;
    }

    /**
     * Reset tutorial state (for testing)
     */
    reset() {
        localStorage.removeItem('bcs-tutorial-seen');
        this.currentStep = 0;
        console.log('Tutorial reset - refresh page to see first-visit prompt');
    }
}

// Export to global scope
window.Tutorial = Tutorial;
