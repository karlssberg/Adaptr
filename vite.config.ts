import { defineConfig } from 'vite'

// Relative asset paths, so the build works at any address
// (e.g. https://<user>.github.io/<repo>/ on GitHub Pages).
export default defineConfig({
  base: './',
})
