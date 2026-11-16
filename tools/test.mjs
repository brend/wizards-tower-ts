// Compile with the project's actual compiler, then test the emitted ES modules.
// Keeps Node 22 support without a TypeScript runtime loader or extra dependencies.
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const output = mkdtempSync(join(tmpdir(), 'wizards-tower-tests-'));
try {
  const compile = spawnSync(resolve('node_modules/.bin/tsc'), ['--noEmit', 'false', '--outDir', output], { stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    writeFileSync(join(output, 'package.json'), '{"type":"module"}');
    symlinkSync(resolve('node_modules'), join(output, 'node_modules'), 'dir'); // lets compiled output resolve @waldrumpus/orb
    const args = process.argv.slice(2);
    const run = spawnSync(process.execPath, args.length ? args : ['--test', 'tests/game.test.mjs', 'tests/voice.test.mjs'], {
      stdio: 'inherit', env: { ...process.env, TEST_BUILD_ROOT: pathToFileURL(output + '/').href },
    });
    process.exitCode = run.status ?? 1;
  }
} finally { rmSync(output, { recursive: true, force: true }); }
