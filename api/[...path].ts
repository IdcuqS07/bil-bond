type VercelRequest = {
  method?: string;
  url?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
  json: (body: unknown) => void;
};

function json(response: VercelResponse, status: number, body: unknown): void {
  response.status(status).setHeader("Cache-Control", "no-store").json(body);
}

export default function handler(request: VercelRequest, response: VercelResponse): void {
  const path = request.url?.split("?")[0] ?? "/api";
  const route = path.replace(/^\/api/, "") || "/";

  if (request.method === "GET" && route === "/health") {
    const databaseConfigured = Boolean(process.env.DATABASE_URL);
    json(response, databaseConfigured ? 200 : 503, {
      status: databaseConfigured ? "ok" : "degraded",
      database: databaseConfigured ? "configured" : "not configured",
      network: "testnet",
      persistence: databaseConfigured ? "ready to verify" : "disabled until DATABASE_URL is configured",
    });
    return;
  }

  if (route === "/transactions/confirm") {
    json(response, 503, {
      error: "Persistence is not configured on this Vercel deployment. Add DATABASE_URL to enable transaction indexing.",
      network: "testnet",
    });
    return;
  }

  json(response, 404, { error: "API route not found." });
}
