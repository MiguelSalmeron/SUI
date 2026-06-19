/**
 * SUI — chatProxy
 *
 * Firebase Cloud Function (2nd gen) that acts as a secure proxy between the
 * mobile app and the OpenRouter chat completions API.
 *
 * Why a proxy:
 *  - The OpenRouter API key NEVER ships inside the mobile bundle. It lives only
 *    here, injected as a Secret Manager secret at runtime.
 *  - The function verifies a Firebase Auth ID token before spending any tokens,
 *    so anonymous-but-authenticated users only.
 *  - It re-streams OpenRouter's Server-Sent Events to the client as a
 *    normalized SSE feed (`data: {"content": "..."}` ... `data: [DONE]`),
 *    which `react-native-sse` consumes on the device.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString, defineInt } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp();
}

// --- Configuration (parameters & secrets) ---------------------------------
// Set the secret with:  firebase functions:secrets:set OPENROUTER_API_KEY
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

// Override in functions/.env or via deploy params. Keep it cheap + empathetic.
const OPENROUTER_MODEL = defineString("OPENROUTER_MODEL", {
  default: "openai/gpt-4o-mini",
});

// Set to 1 in production if cold-start latency hurts the < 3s target.
const MIN_INSTANCES = defineInt("CHAT_MIN_INSTANCES", { default: 0 });

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// --- Hard guardrails (cost control) ---------------------------------------
const MAX_MESSAGES = 12; // ficha + last ~10 turns
const MAX_CHARS_PER_MESSAGE = 2000;
const MAX_OUTPUT_TOKENS = 600;

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

export const chatProxy = onRequest(
  {
    secrets: [OPENROUTER_API_KEY],
    cors: true,
    minInstances: MIN_INSTANCES,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (req, res): Promise<void> => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // --- Authentication: require a valid Firebase ID token ------------------
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).json({ error: "Missing Authorization bearer token" });
      return;
    }
    try {
      await getAuth().verifyIdToken(match[1]);
    } catch (err) {
      logger.warn("Rejected request: invalid ID token", err);
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    // --- Validate payload ---------------------------------------------------
    const messages = sanitizeMessages(req.body?.messages);
    if (!messages) {
      res.status(400).json({ error: "Invalid 'messages' payload" });
      return;
    }

    // --- Open the upstream stream ------------------------------------------
    let upstream: Response;
    try {
      upstream = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY.value()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sui.app",
          "X-Title": "SUI",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL.value(),
          messages,
          stream: true,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
      });
    } catch (err) {
      logger.error("Failed to reach OpenRouter", err);
      res.status(502).json({ error: "Upstream connection failed" });
      return;
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      logger.error("OpenRouter error", { status: upstream.status, detail });
      res.status(502).json({ error: "Upstream error", status: upstream.status });
      return;
    }

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

        // OpenRouter SSE events are separated by double newlines.
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
      logger.error("Stream interrupted", err);
      send(JSON.stringify({ error: "stream_interrupted" }));
    } finally {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
);
