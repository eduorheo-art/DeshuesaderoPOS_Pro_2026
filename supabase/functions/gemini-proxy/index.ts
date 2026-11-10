const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});

const jsonResponse = (origin: string, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
  });

Deno.serve(async request => {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = (Deno.env.get("YONKE_ALLOWED_ORIGINS") || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Method not allowed" });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const ownerUserId = Deno.env.get("YONKE_OWNER_USER_ID");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || !geminiKey || !ownerUserId) {
    return jsonResponse(origin, 503, { error: "AI service is not configured" });
  }

  try {
    const identityResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization }
    });
    if (!identityResponse.ok) return jsonResponse(origin, 401, { error: "Authentication required" });
    const identity = await identityResponse.json();
    if (identity.id !== ownerUserId) return jsonResponse(origin, 403, { error: "Not authorized" });

    const maxRequestBytes = 16 * 1024 * 1024;
    const declaredSize = Number(request.headers.get("Content-Length") || 0);
    if (declaredSize > maxRequestBytes) {
      return jsonResponse(origin, 413, { error: "Request too large" });
    }
    const reader = request.body?.getReader();
    if (!reader) return jsonResponse(origin, 400, { error: "Request body required" });
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxRequestBytes) {
        await reader.cancel();
        return jsonResponse(origin, 413, { error: "Request too large" });
      }
      chunks.push(value);
    }
    const bodyBytes = new Uint8Array(receivedBytes);
    let offset = 0;
    chunks.forEach(chunk => {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    });
    const rawBody = new TextDecoder().decode(bodyBytes);
    let payload: { model?: string; request?: { contents?: unknown[] } };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse(origin, 400, { error: "Invalid JSON" });
    }
    const models = new Set(["gemini-3.6-flash"]);
    if (typeof payload.model !== "string" || !models.has(payload.model) ||
        !payload.request || !Array.isArray(payload.request.contents)) {
      return jsonResponse(origin, 400, { error: "Invalid AI request" });
    }
    const upstreamBody = JSON.stringify(payload.request);
    if (!upstreamBody) return jsonResponse(origin, 400, { error: "Invalid AI request" });

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: upstreamBody,
        signal: AbortSignal.timeout(60000)
      }
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": upstream.headers.get("Content-Type") || "application/json"
      }
    });
  } catch (error) {
    console.error("Gemini proxy request failed:", error instanceof Error ? error.name : "unknown error");
    return jsonResponse(origin, 502, { error: "AI request failed" });
  }
});
