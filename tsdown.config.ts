import { defineConfig, type UserConfig } from 'tsdown'

// Host half (lib/index.js + lib/index.d.ts) is emitted by `tsc` — standard
// TC39 decorators in @Remote must reach Node untranspiled-safe, and tsc's
// NodeNext output matches the upstream dsh host packages. This config builds
// only the standalone CLI artifact.

const cli: UserConfig = {
  name: 'cli',
  entry: { cli: 'src/cli/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  fixedExtension: false,
  dts: false,
  clean: false,
  // The CLI is dependency-free (global fetch/WebSocket in Node >= 22).
  deps: { neverBundle: () => false },
  banner: { js: '#!/usr/bin/env node' },
}

export default defineConfig([cli])
