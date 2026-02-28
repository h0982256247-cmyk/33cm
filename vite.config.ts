import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws'
    }
  },
  build: {
    // 啟用 source maps 用於調試
    sourcemap: true,

    // 代碼分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
        }
      }
    },

    // 最小化配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false  // 保留 console.log（開發時有用）
      }
    }
  }
});
