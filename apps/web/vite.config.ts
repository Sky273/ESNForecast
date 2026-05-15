import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "reject-malformed-uris-before-vite-static",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          try {
            if (req.url) decodeURI(req.url);
            next();
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Bad request: malformed URI");
          }
        });
      }
    },
    react()
  ],
  server: {
    port: 5173,
    allowedHosts: true
  }
});
