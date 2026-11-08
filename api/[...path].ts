import express from "express";
import { apiRouter } from "../server/api.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

// Vercel routes /api/* to this catch-all function. Express receives the
// original /api prefix, while the shared router is defined from /health.
app.use((request, _response, next) => {
  if (request.url === "/api" || request.url.startsWith("/api/")) {
    request.url = request.url.slice(4) || "/";
  }
  next();
});

app.use(apiRouter);

export default app;
