import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    EventDialog: 'src/VerticalTimeline/EventDialog.tsx',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: ['react', 'react-dom'],
  },
  css: {
    splitting: true,
  },
});