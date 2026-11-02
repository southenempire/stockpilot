import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { rootNodeFromAnchor } = require('@codama/nodes-from-anchor');
const { renderVisitor } = require('@codama/renderers-js');
const { visit } = require('@codama/visitors-core');

const idlPath = path.resolve(__dirname, '../anchor/idl/stockpilot.json');
const outputPath = path.resolve(__dirname, '../clients/js');

if (!fs.existsSync(idlPath)) {
  console.error(`IDL file not found at: ${idlPath}`);
  process.exit(1);
}

const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const root = rootNodeFromAnchor(idl);
visit(root, renderVisitor(outputPath));

console.log(`✅ StockPilot TypeScript client generated successfully at ${outputPath}`);
