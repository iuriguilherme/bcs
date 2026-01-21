/**
 * Build script to bundle cell-simulator.html from source files
 * 
 * Usage: 
 *   deno run --allow-read --allow-write --allow-run build.ts [version]
 * 
 * Examples:
 *   deno run --allow-read --allow-write --allow-run build.ts         # Uses git describe
 *   deno run --allow-read --allow-write --allow-run build.ts v1.2.3  # Uses specified version
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
    'src/catalogue/cell-blueprints.js',
    'src/catalogue/catalogue.js',
    'src/viewer/viewer.js',
    'src/viewer/controls.js',
    'src/viewer/catalogue-ui.js',
    'src/viewer/tutorial.js',
    'src/main.js'
];

/**
 * Get the version from command-line argument or git tags
 * Usage: deno run --allow-read --allow-write --allow-run build.ts [version]
 * 
 * If a version argument is provided (e.g., "v1.2.3"), it will be used directly.
 * This allows building with a version BEFORE tagging, so the tagged commit
 * contains the correct version in the bundle.
 * 
 * Workflow:
 *   1. deno run --allow-read --allow-write --allow-run build.ts v1.2.3
 *   2. git add . && git commit -m "Release v1.2.3"
 *   3. git tag v1.2.3
 *   4. git push && git push --tags
 */
async function getVersion(): Promise<string> {
    // Check for command-line argument first
    const args = Deno.args;
    if (args.length > 0 && args[0]) {
        const version = args[0].trim();
        console.log(`  Using version from argument: ${version}`);
        return version;
    }

    // Fall back to git describe for development builds
    try {
        const command = new Deno.Command('git', {
            args: ['describe', '--tags', '--always'],
            stdout: 'piped',
            stderr: 'piped',
        });
        const { code, stdout } = await command.output();
        if (code === 0) {
            const version = new TextDecoder().decode(stdout).trim();
            return version || 'dev';
        }
    } catch (e) {
        console.warn('Could not get git version:', e.message);
    }
    return 'dev';
}

async function build() {
    console.log('Building index.html (production bundle)...');

    // Get version from git
    const version = await getVersion();
    console.log(`  Version: ${version}`);

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
// Version: ${version}
// Generated: ${new Date().toISOString()}
// ============================================

${allScripts}
    </script>
</body>
</html>`;

    // Replace version placeholder
    bundledHtml = bundledHtml.replaceAll('{{VERSION}}', version);

    // Write output
    await Deno.writeTextFile(outputFile, bundledHtml);
    console.log(`\nBuild complete: ${outputFile}`);
    console.log(`Version: ${version}`);
    console.log(`Total size: ${(bundledHtml.length / 1024).toFixed(1)} KB`);
}

build().catch(console.error);

