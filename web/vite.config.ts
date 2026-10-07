import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The API only allows this origin (WEB_ORIGIN), so never drift to another port.
  server: { port: 5174, strictPort: true },
})
