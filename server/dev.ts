import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./api.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 3000);
const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use("/api", apiRouter);

if (process.env.NODE_ENV === "production") {
  const staticRoot = path.join(projectRoot, "dist");
  app.use(express.static(staticRoot, { index: false }));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(staticRoot, "index.html"));
  });
} else {
  const vite = await createViteServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    server: {
      middlewareMode: true,
      hmr: { server: httpServer, host: "127.0.0.1" },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
  httpServer.on("close", () => void vite.close());
}

httpServer.listen(port, "127.0.0.1", () => {
  console.info(`Bil Bond is listening on 127.0.0.1:${port}. Network: NEAR Testnet only.`);
});
