import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { mapruler: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true
  },
  {
    entry: { mapruler: 'src/cdn.ts' },
    format: ['iife'],
    minify: true,
    sourcemap: true,
    outExtension: () => ({ js: '.min.js' })
  }
])
