import { preview } from "vite";

import { createPlaywrightRuntime, isExpectedHealthRequest } from "./playwright-runtime.mjs";

const runtime = createPlaywrightRuntime(process.cwd());

const identityPlugin = {
  name: "moyang-playwright-preview-identity",
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.startsWith("/__moyang_e2e_health")) {
        next();
        return;
      }

      if (!isExpectedHealthRequest(request.url, runtime)) {
        response.statusCode = 409;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ ok: false, reason: "preview identity mismatch" }));
        return;
      }

      response.statusCode = 200;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ ok: true, app: runtime.appId, commit: runtime.commit }));
    });
  },
};

const server = await preview({
  plugins: [identityPlugin],
  preview: {
    host: "127.0.0.1",
    port: runtime.port,
    strictPort: true,
  },
});

console.log(`[playwright-preview] ${runtime.appId}@${runtime.commit.slice(0, 12)} listening on ${runtime.baseURL}`);

const close = async () => {
  await server.close();
  process.exit(0);
};

process.once("SIGINT", close);
process.once("SIGTERM", close);
