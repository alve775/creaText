const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const { crx } = require("@crxjs/vite-plugin");
const manifest = require("./manifest.json");

module.exports = defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    sourcemap: false,
    target: "es2022"
  }
});
