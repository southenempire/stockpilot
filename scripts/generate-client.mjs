import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve Codama dependencies
let rootNodeFromAnchor, renderVisitor, visit;

try {
  ({ rootNodeFromAnchor } = require('@codama/nodes-from-anchor'));
  ({ renderVisitor } = require('@codama/renderers-js'));
  ({ visit } = require('@codama/visitors-core'));
} catch {
  // Fallback to absolute/sibling path if running from monorepo/scratch
  const altPath = '/Users/southen_/.gemini/antigravity/scratch/fundraiser-codama/node_modules';
  ({ rootNodeFromAnchor } = require(`${altPath}/@codama/nodes-from-anchor`));
  ({ renderVisitor } = require(`${altPath}/@codama/renderers-js`));
  ({ visit } = require(`${altPath}/@codama/visitors-core`));
}

const idlPath = path.resolve(__dirname, '../anchor/target/idl/stockpilot.json');
const outputPath = path.resolve(__dirname, '../clients/js');

if (!fs.existsSync(idlPath)) {
  console.error(`IDL file not found at: ${idlPath}`);
  process.exit(1);
}

const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const root = rootNodeFromAnchor(idl);
visit(root, renderVisitor(outputPath));

console.log(`✅ StockPilot TypeScript client generated successfully at ${outputPath}`);
