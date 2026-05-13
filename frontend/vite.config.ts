import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 生态单独分包
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI 组件库分包
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
          // Ant Design 单独分包（大体积）
          'antd': ['antd', '@ant-design/icons'],
          // 动画库单独分包
          'framer-motion': ['framer-motion'],
          // 图标库单独分包
          'icons': ['lucide-react', 'react-icons'],
          // 拖拽库单独分包
          'dnd': ['react-dnd', 'react-dnd-html5-backend'],
          // Markdown 渲染单独分包
          'markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // kB - 提高限制
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});