/**
 * Build script to bundle cell-simulator.html from source files
 * Usage: deno run --allow-read --allow-write build.ts
 */

const sourceDir = './src';
const devHtml = './dev.html';        // Development entry point (separate scripts)
const outputFile = './index.html';   // Production bundle for GitHub Pages
const cssFile = './index.css';

// Script loading order from index.html
// NOTE: protein.js is excluded since polymer.js provides backward-compatible Protein alias
const scriptOrder = [
    'src/core/utils.js',
    'src/data/periodic-table.js',
    'src/data/stable-molecules.js',
    'src/entities/atom.js',
    'src/entities/bond.js',
    'src/entities/molecule.js',
    // 'src/entities/protein.js', // EXCLUDED: polymer.js has Protein = Polymer alias
    'src/entities/polymer.js',
    'src/entities/intention.js',
    'src/systems/atom-spawner.js',
    'src/systems/neural-network.js',
    'src/entities/cell-memory.js',
    'src/entities/cell.js',
    'src/entities/prokaryote.js',
    'src/entities/prokaryote-factory.js',
    'src/core/environment.js',
    'src/core/simulation.js',
    'src/catalogue/blueprint.js',
    'src/catalogue/monomer-templates.js',
    'src/catalogue/polymer-blueprints.js',
    'src/catalogue/catalogue.js',
    'src/viewer/viewer.js',
    'src/viewer/controls.js',
    'src/viewer/catalogue-ui.js',
    'src/main.js'
];

async function build() {
    console.log('Building index.html (production bundle)...');

    // Read dev.html as template
    const devContent = await Deno.readTextFile(devHtml);

    // Read CSS
    const cssContent = await Deno.readTextFile(cssFile);

    // Read and concatenate all scripts
    let allScripts = '';
    for (const scriptPath of scriptOrder) {
        try {
            const content = await Deno.readTextFile(scriptPath);
            allScripts += `// ==== ${scriptPath} ====\n${content}\n\n`;
            console.log(`  Added: ${scriptPath}`);
        } catch (e) {
            console.warn(`  Warning: Could not read ${scriptPath}: ${e.message}`);
        }
    }

    // Create bundled HTML
    let bundledHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BioChemSim - Multi-Level Life Simulation</title>
    <link rel="stylesheet" href="assets/css/all.min.css">
    <style>
${cssContent}
    </style>
</head>
<body>
`;

    // Extract body content from dev.html (everything between <body> and </body>)
    const bodyMatch = devContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        // Remove script tags from body
        let bodyContent = bodyMatch[1];
        bodyContent = bodyContent.replace(/<script[^>]*src[^>]*><\/script>/gi, '');
        bundledHtml += bodyContent;
    }

    // Add bundled scripts
    bundledHtml += `
    <script>
// ============================================
// Bundled BioChemSim Scripts
// Generated: ${new Date().toISOString()}
// ============================================

${allScripts}
    </script>
</body>
</html>`;

    // Write output
    await Deno.writeTextFile(outputFile, bundledHtml);
    console.log(`\nBuild complete: ${outputFile}`);
    console.log(`Total size: ${(bundledHtml.length / 1024).toFixed(1)} KB`);
}

build().catch(console.error);
