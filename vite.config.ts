import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import legacy from "@vitejs/plugin-legacy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    legacy({
      targets: ['defaults', 'not IE 11', 'Safari >= 13'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2019',
    rollupOptions: {
      output: {
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const extType = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(css)$/i.test(assetInfo.name || '')) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for better debugging
    sourcemap: mode === 'development',
    // Minify for production
    minify: mode === 'production' ? 'terser' : false,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: false, // Temporarily enabled for boot diagnostics
        drop_debugger: true,
      },
    } : undefined
  },
}));
