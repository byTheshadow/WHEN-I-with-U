import react from '@vitejs/plugin-react';

export default {
  base: '/WHEN-I-with-U/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
};
