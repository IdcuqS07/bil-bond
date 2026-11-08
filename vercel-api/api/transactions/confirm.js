export default function handler(_request, response) {
  response
    .status(503)
    .setHeader("Cache-Control", "no-store")
    .json({
      error: "Persistence is not configured on this Vercel deployment. Add DATABASE_URL to enable transaction indexing.",
      network: "testnet",
    });
}
