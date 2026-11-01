import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const helper = fileURLToPath(new URL('../../scripts/runtime-dependencies.mjs', import.meta.url));

async function fixture(t, modules) {
  const root = await mkdtemp(join(tmpdir(), 'storyweave-runtime-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'src');
  await mkdir(source);
  for (const [path, code] of Object.entries(modules)) {
    const target = join(source, path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, code);
  }
  const graph = async (entries) => JSON.parse((await execute(process.execPath, ['--experimental-vm-modules', '--no-warnings', helper, source, JSON.stringify(entries)], { maxBuffer: 1024 * 1024 })).stdout);
  return { root, source, graph };
}

test('packaging follows parsed static imports and re-exports without running source', async (t) => {
  const setup = await fixture(t, {
    'main.mjs': `import { value }\nfrom './used.mjs';\nimport './side-effect.mjs';\nexport * from './reexport.mjs';\nimport data from './data.json' with { type: 'json' };\nthrow new Error('Build-time import must never execute');\nconst text = "import missing from './does-not-exist.mjs'";`,
    'used.mjs': "export const value = 1; export { other } from './nested.mjs';",
    'side-effect.mjs': "import 'node:fs'; import './used.mjs';",
    'reexport.mjs': "export { other as renamed } from './nested.mjs';",
    'nested.mjs': "export const other = 2; import './used.mjs';",
    'data.json': '{"value":1}',
    'unused.mjs': 'this is deliberately invalid source',
  });
  assert.deepEqual(await setup.graph(['main.mjs']), { 'main.mjs': ['data.json', 'main.mjs', 'nested.mjs', 'reexport.mjs', 'side-effect.mjs', 'used.mjs'] });
});

test('packaging rejects missing, escaped, external and new computed runtime imports', async (t) => {
  const setup = await fixture(t, {
    'missing.mjs': "import './absent.mjs';",
    'escaped.mjs': "import '../outside.mjs';",
    'external.mjs': "import 'new-runtime-dependency';",
    'dynamic.mjs': "const target = './local.mjs'; await import(target);",
    'literal-dynamic.mjs': "await import /* comment */ ('./local.mjs');",
    'local.mjs': 'export const ok=true;',
    'broken.mjs': 'export const value = ;',
  });
  await writeFile(join(setup.root, 'outside.mjs'), 'export const outside=true;');
  for (const entry of ['missing.mjs', 'escaped.mjs', 'external.mjs', 'dynamic.mjs', 'literal-dynamic.mjs', 'broken.mjs']) await assert.rejects(setup.graph([entry]), `${entry} must stop the build`);
  await symlink(join(setup.root, 'outside.mjs'), join(setup.source, 'linked.mjs'));
  await assert.rejects(setup.graph(['linked.mjs']));
});
