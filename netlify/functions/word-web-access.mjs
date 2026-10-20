import access from "../../server/wordWebAccess.js";

export const config = {
  path: "/api/word-web/*",
  rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ["ip"], action: "rate_limit" },
};

export default async function handler(request, context) {
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 24576) return new Response("Request is too large.", { status: 413 });
    const result = await access.handleWordWebAccess({
      method: request.method,
      pathname: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers),
      body: request.method === "GET" || request.method === "HEAD" ? "" : await request.text(),
      ip: context.ip,
    });
    return new Response(result.body, { status: result.statusCode, headers: result.headers });
  } catch {
    return Response.json({ error: "Word Web sign-in is temporarily unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" },
    });
  }
}
