import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',      // 👈 chạy từ container
    port: 5173,           // 👈 port cần expose
    strictPort: true,     // 👈 ép chạy đúng port, không đổi nếu bị chiếm
    allowedHosts: ["localhost", "127.0.0.1", "0.0.0.0", "ai-agent.hykura.id.vn"]
  }
  
})
