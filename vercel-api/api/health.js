export default function handler(_request, response) {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  response
    .status(databaseConfigured ? 200 : 503)
    .setHeader("Cache-Control", "no-store")
    .json({
      status: databaseConfigured ? "ok" : "degraded",
      database: databaseConfigured ? "configured" : "not configured",
      network: "testnet",
      persistence: databaseConfigured ? "ready to verify" : "disabled until DATABASE_URL is configured",
    });
}
