import { defineConfig, type UserConfig } from 'tsdown'

const host: UserConfig = {
  name: 'host',
  entry: { index: 'src/host/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  fixedExtension: false,
  dts: true,
  clean: true,
  // dsh-* and @deepseek-ai/cordis resolve from the host profile's node_modules.
  deps: { neverBundle: specifier => !specifier.startsWith('.') },
}

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
  deps: { neverBundle: specifier => !specifier.startsWith('.') },
}

export default defineConfig([host, cli])
