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
  const origin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const allowedOrigins = Array.from(new Set([
    "https://eduorheo-art.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "null",
    ...(Deno.env.get("YONKE_ALLOWED_ORIGINS") || "")
      .split(",")
      .map(value => value.trim().replace(/\/$/, ""))
      .filter(Boolean)
  ]));

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin || "*") });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Method not allowed" });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKeys = (Deno.env.get("GEMINI_API_KEY") || "")
    .split(/[,\r\n;]+/)
    .map(k => k.trim().replace(/^["']+|["']+$/g, "").trim())
    .filter(Boolean);
  const ownerUserId = Deno.env.get("YONKE_OWNER_USER_ID");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || geminiKeys.length === 0 || !ownerUserId) {
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
      return jsonResponse(origin, 400, { error: { message: "Invalid JSON in request body", status: "INVALID_ARGUMENT" } });
    }
    const models = new Set(["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
    if (typeof payload.model !== "string") {
      return jsonResponse(origin, 400, { error: { message: "Field 'model' is required as a string", status: "INVALID_ARGUMENT" } });
    }
    if (!models.has(payload.model)) {
      return jsonResponse(origin, 400, { error: { message: `Model '${payload.model}' not supported. Available models: ${Array.from(models).join(", ")}`, status: "INVALID_ARGUMENT" } });
    }
    if (!payload.request || typeof payload.request !== "object") {
      return jsonResponse(origin, 400, { error: { message: "Field 'request' is required as an object", status: "INVALID_ARGUMENT" } });
    }
    if (!Array.isArray(payload.request.contents)) {
      return jsonResponse(origin, 400, { error: { message: "Field 'request.contents' must be an array", status: "INVALID_ARGUMENT" } });
    }

    // Si la petición contiene imágenes (inlineData), Gemini rechaza tools (googleSearch) con 400
    const hasInlineData = payload.request.contents.some((c: any) =>
      Array.isArray(c?.parts) && c.parts.some((p: any) => p?.inlineData)
    );
    if (hasInlineData && (payload.request as any).tools) {
      delete (payload.request as any).tools;
    }
    const upstreamBody = JSON.stringify(payload.request);
    if (!upstreamBody) return jsonResponse(origin, 400, { error: { message: "Could not serialize request body", status: "INVALID_ARGUMENT" } });

    let upstream: Response | null = null;
    let upstreamText = "";

    for (let i = 0; i < geminiKeys.length; i++) {
      const currentKey = geminiKeys[i];
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": currentKey
          },
          body: upstreamBody,
          signal: AbortSignal.timeout(60000)
        }
      );

      upstreamText = await upstream.text();

      if (upstream.ok) {
        break;
      }

      const isQuotaError = upstream.status === 429 || upstreamText.includes("RESOURCE_EXHAUSTED");
      const isInvalidKeyError = upstream.status === 401 || upstreamText.includes("API_KEY_INVALID") || upstreamText.includes("UNAUTHENTICATED");
      console.error(`Gemini upstream error (${upstream.status}) for model ${payload.model} [key ${i + 1}/${geminiKeys.length}, len=${currentKey.length}]:`, upstreamText);

      if ((isQuotaError || isInvalidKeyError) && i < geminiKeys.length - 1) {
        continue;
      }

      try {
        const errorJson = JSON.parse(upstreamText);
        return jsonResponse(origin, upstream.status, errorJson);
      } catch {
        return jsonResponse(origin, upstream.status, {
          error: {
            code: upstream.status,
            message: upstreamText || `HTTP ${upstream.status} from Gemini API`,
            status: isQuotaError ? "RESOURCE_EXHAUSTED" : "UPSTREAM_ERROR"
          }
        });
      }
    }

    return new Response(upstreamText, {
      status: upstream?.status || 200,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": upstream?.headers.get("Content-Type") || "application/json"
      }
    });
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "unknown error";
    const errorMsg = rawMsg.replace(/key=[^&\s]+/gi, "key=REDACTED");
    console.error("Gemini proxy request failed:", errorMsg);
    return jsonResponse(origin, 502, {
      error: {
        code: 502,
        message: `Gemini proxy error: ${errorMsg}`,
        status: "PROXY_ERROR"
      }
    });
  }
});
