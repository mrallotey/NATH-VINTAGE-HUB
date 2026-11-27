import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        storefront: resolve(root, 'index.html'),
        owner: resolve(root, 'owner/index.html'),
      },
    },
  },
});
