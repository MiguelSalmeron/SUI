/**
 * SUI — chatProxy
 *
 * Firebase Cloud Function (2nd gen) that acts as a secure proxy between the
 * mobile app and the Azure OpenAI chat completions API.
 *
 * Why a proxy:
 *  - The Azure API key NEVER ships inside the mobile bundle. It lives only
 *    here, injected as a Secret Manager secret at runtime.
 *  - The function verifies a Firebase Auth ID token before spending any tokens,
 *    so anonymous-but-authenticated users only.
 *  - Enforces per-uid rate limiting via Firestore (auditoría prioridad 5).
 *  - Upstream fetch has a hard timeout guard below the function timeout.
 *  - It re-streams Azure's Server-Sent Events to the client as a
 *    normalized SSE feed (`data: {"content": "..."}` ... `data: [DONE]`),
 *    which `react-native-sse` consumes on the device.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString, defineInt } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// --- Configuration (parameters & secrets) ---------------------------------
// Set the secret with:  firebase functions:secrets:set AZURE_OPENAI_API_KEY
const AZURE_OPENAI_API_KEY = defineSecret("AZURE_OPENAI_API_KEY");

// Override in functions/.env or via deploy params. Deployment id in Azure
// Foundry project "Raiz-lifeplants" (account "Raiz", rg "lifeplants").
const AZURE_MODEL = defineString("AZURE_MODEL", {
  default: "gpt-5-mini",
});

// Set to 1 in production if cold-start latency hurts the < 3s target.
const MIN_INSTANCES = defineInt("CHAT_MIN_INSTANCES", { default: 0 });

const AZURE_URL = "https://raiz.services.ai.azure.com/openai/v1/chat/completions";

// --- Hard guardrails (cost control) ---------------------------------------
const MAX_MESSAGES = 12; // ficha + last ~10 turns
const MAX_CHARS_PER_MESSAGE = 2000;
const MAX_OUTPUT_TOKENS = 600;
// Upstream timeout: well below the 120s function timeout so we can emit a
// clean error to the client instead of Cloud Run killing the request.
const UPSTREAM_TIMEOUT_MS = 90_000;
// Rate limit: max requests per uid per sliding window.
const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function setCorsHeaders(res: { set: (k: string, v: string) => void }): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
}

function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const trimmed = input.slice(-MAX_MESSAGES);
  const out: ChatMessage[] = [];

  for (const raw of trimmed) {
    if (!raw || typeof raw !== "object") return null;
    const role = (raw as ChatMessage).role;
    const content = (raw as ChatMessage).content;
    if (role !== "system" && role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0) return null;
    out.push({ role, content: content.slice(0, MAX_CHARS_PER_MESSAGE) });
  }

  return out;
}

/**
 * Enforce per-uid rate limit via Firestore document `rate_limits/{uid}`.
 * Sliding window: counts requests within the last RATE_LIMIT_WINDOW_MIN minutes.
 * Returns { allowed: true } or { allowed: false, retryAfterSec }.
 * Best-effort: on Firestore errors, allows the request (fail-open) to avoid
 * blocking all users during a transient Firestore outage.
 */
async function checkRateLimit(
  uid: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  try {
    const ref = db.collection("rate_limits").doc(uid);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MIN * 60_000;

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as
        | { timestamps?: number[] }
        | undefined;
      const all = data?.timestamps ?? [];
      // Keep only timestamps within the window.
      const recent = all.filter((ts) => ts >= windowStart);
      if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
        const oldest = Math.min(...recent);
        const retryAfterSec = Math.ceil((oldest + RATE_LIMIT_WINDOW_MIN * 60_000 - now) / 1000);
        return { allowed: false as const, retryAfterSec: Math.max(retryAfterSec, 1) };
      }
      recent.push(now);
      tx.set(ref, { timestamps: recent, updatedAt: now });
      return { allowed: true as const };
    });
  } catch (err) {
    // Fail-open: log and allow. Better than a global outage from a Firestore blip.
    logger.warn("rate-limit check failed (fail-open)", {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true as const };
  }
}

export const chatProxy = onRequest(
  {
    secrets: [AZURE_OPENAI_API_KEY],
    cors: true,
    minInstances: MIN_INSTANCES,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (req, res): Promise<void> => {
    setCorsHeaders(res);
    logger.info("chatProxy invoked", { method: req.method, path: req.path, hasBody: !!req.body });

    if (req.method === "OPTIONS") {
      logger.info("OPTIONS preflight ok");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      logger.warn("405 method not allowed", { method: req.method });
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // --- Authentication: require a valid Firebase ID token ------------------
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      logger.warn("401 missing bearer", { authHeaderLen: authHeader.length });
      res.status(401).json({ error: "Missing Authorization bearer token" });
      return;
    }
    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(match[1]);
      uid = decoded.uid;
      logger.info("ID token verified ok", { uid });
    } catch (err) {
      // Do NOT log the token or any preview of it (security: avoid partial
      // secret leakage in logs).
      logger.error("401 token verify failed", {
        errorMsg: err instanceof Error ? err.message : String(err),
        errorName: err instanceof Error ? err.name : "Unknown",
        tokenLen: match[1].length,
      });
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    // --- Rate limiting (auditoría prioridad 5) ------------------------------
    const rl = await checkRateLimit(uid);
    if (!rl.allowed) {
      logger.warn("429 rate limited", { uid, retryAfterSec: rl.retryAfterSec });
      res.set("Retry-After", String(rl.retryAfterSec));
      res.status(429).json({
        error: "Rate limit exceeded",
        retryAfterSec: rl.retryAfterSec,
      });
      return;
    }

    // --- Validate payload ---------------------------------------------------
    const messages = sanitizeMessages(req.body?.messages);
    if (!messages) {
      logger.warn("400 invalid messages", { bodyType: typeof req.body, bodyKeys: req.body ? Object.keys(req.body) : [] });
      res.status(400).json({ error: "Invalid 'messages' payload" });
      return;
    }
    logger.info("messages ok", { count: messages.length, model: AZURE_MODEL.value() });

    // --- Open the upstream stream (with hard timeout guard) -----------------
    let upstream: Response;
    try {
      upstream = await fetch(AZURE_URL, {
        method: "POST",
        headers: {
          "api-key": AZURE_OPENAI_API_KEY.value(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AZURE_MODEL.value(),
          messages,
          stream: true,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
          // GPT-5 series spends tokens "thinking" before responding. "low"
          // keeps empathy quality while cutting first-token latency under
          // the < 3s SUI target. Allowed: "low" | "medium" | "high".
          reasoning_effort: "low",
        }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout =
        err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      logger.error("Failed to reach Azure OpenAI", {
        isTimeout,
        error: err instanceof Error ? err.message : String(err),
      });
      res
        .status(isTimeout ? 504 : 502)
        .json({ error: isTimeout ? "Upstream timeout" : "Upstream connection failed" });
      return;
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      logger.error("Azure upstream non-ok", {
        status: upstream.status,
        statusText: upstream.statusText,
        detail: detail.slice(0, 500),
        model: AZURE_MODEL.value(),
        url: AZURE_URL,
        keyLen: AZURE_OPENAI_API_KEY.value().length,
      });
      res.status(502).json({ error: "Upstream error", status: upstream.status, detail: detail.slice(0, 300) });
      return;
    }
    logger.info("Azure stream opened ok", { status: upstream.status });

    // --- Re-stream as normalized SSE ---------------------------------------
    res.set("Content-Type", "text/event-stream; charset=utf-8");
    res.set("Cache-Control", "no-cache, no-transform");
    res.set("Connection", "keep-alive");
    res.set("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const decoder = new TextDecoder();
    let buffer = "";

    const send = (payload: string): void => {
      res.write(`data: ${payload}\n\n`);
    };

    try {
      // undici's fetch body is an async-iterable of Uint8Array in Node 20.
      for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });

        // Azure SSE events are separated by double newlines.
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          for (const line of rawEvent.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "" || data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const delta: string | undefined = json?.choices?.[0]?.delta?.content;
              if (delta) {
                send(JSON.stringify({ content: delta }));
              }
            } catch {
              // Ignore keep-alive comments / partial JSON; next chunk fixes it.
            }
          }
        }
      }
    } catch (err) {
      const isTimeout =
        err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      logger.error("Stream interrupted", { isTimeout, error: err instanceof Error ? err.message : String(err) });
      send(JSON.stringify({ error: isTimeout ? "stream_timeout" : "stream_interrupted" }));
    } finally {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
);
