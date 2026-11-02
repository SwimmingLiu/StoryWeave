import { resolve } from 'node:path';
import { packagePresentation } from '../bento/presentation.mjs';
import { main as adapterCommand } from '../bento/cli.mjs';

const flag = (args, name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };

export async function main(args) {
  const raw = args[0];
  if (raw === 'doctor') return adapterCommand(args);
  if (!raw || ['help', '-h', '--help'].includes(raw)) {
    console.log('Usage: node scripts/orchestrate.mjs [orchestrate] <producer-project> [--out path] [--no-bento-update] [--json]');
    return 0;
  }
  const project = raw === 'orchestrate' ? args[1] : raw;
  if (!project) throw new Error('A producer project directory is required.');
  // A bundled adapter replaces the former sibling CLI path and its duplicate guards.
  const result = await packagePresentation(resolve(project), { output: flag(args, '--out'), update: args.includes('--no-bento-update') ? 'off' : 'auto' });
  const manifest = result.manifest;
  console.log(JSON.stringify({ producer: { name: manifest.producer, kind: manifest.kind, version: manifest.version, project: resolve(project), slides: manifest.slides.length }, bento: { output: result.output, qa: result.qa.summary, report: result.qa.report_path } }, null, args.includes('--json') ? 0 : 2));
  return 0;
}
