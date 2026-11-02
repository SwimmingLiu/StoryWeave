import { resolve } from 'node:path';
import { optionalDependency, resolveSkillRoot } from '../core/resources.mjs';
import { bentoStatus, updateBento } from './shell.mjs';
import { buildPresentation, inspectPresentation } from './presentation.mjs';

const HELP = `storyweave-express
Commands:
  build <producer-project> [--out presentation.bento.html] [--no-bento-update]
  qa <producer-project> [--file presentation.bento.html] [--json]
  bento status|update [--force] [--json]
  doctor [--json]
Consumes an attested storyweave-output.json and producer qa_report.json.
`;
const flag = (args, name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };

export async function main(args) {
  const command = args[0];
  if (!command || ['help', '-h', '--help'].includes(command)) { console.log(HELP); return 0; }
  const skillRoot = resolveSkillRoot('storyweave-express');
  if (command === 'bento') {
    const action = args[1] ?? 'status';
    if (!['status', 'update'].includes(action)) throw new Error('bento expects status or update');
    const result = action === 'update' ? await updateBento({ force: args.includes('--force') }) : await bentoStatus({ skillRoot });
    console.log(JSON.stringify(result, null, 2)); return 0;
  }
  if (command === 'doctor') {
    const status = await bentoStatus({ skillRoot });
    const report = { node: { version: process.versions.node, supported: Number(process.versions.node.split('.')[0]) >= 20 }, bento: { bundled: Boolean(status.bundled), format: 'bento/slides' }, html_adapter: { playwright: Boolean(await optionalDependency('playwright', 'storyweave-express')) } };
    console.log(JSON.stringify(report, null, 2)); return report.node.supported && report.bento.bundled ? 0 : 1;
  }
  if (!args[1]) throw new Error('A producer project directory is required.');
  const root = resolve(args[1]);
  if (command === 'build') {
    const result = await buildPresentation(root, { output: flag(args, '--out'), update: args.includes('--no-bento-update') ? 'off' : 'auto', forceUpdate: args.includes('--force-bento-update') });
    console.log(result.output); return 0;
  }
  if (command === 'qa') {
    const report = await inspectPresentation(root, { output: flag(args, '--file') });
    console.log(JSON.stringify(report, null, args.includes('--json') ? 0 : 2)); return report.export_ready ? 0 : 2;
  }
  throw new Error(`Unknown command: ${command}`);
}
