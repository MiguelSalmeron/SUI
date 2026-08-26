import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { authenticateBearer } from "./chat/auth";
import { openAzureStream, isUpstreamTimeout } from "./chat/azure";
import {
  AZURE_MODEL,
  AZURE_OPENAI_API_KEY,
  AZURE_URL,
  MIN_INSTANCES,
} from "./chat/config";
import { checkRateLimit } from "./chat/rateLimit";
import { relayAzureSse } from "./chat/sse";
import { sanitizeMessages } from "./chat/validation";

type HeaderResponse = { set: (key: string, value: string) => void };

function setCorsHeaders(response: HeaderResponse): void {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.set("Access-Control-Max-Age", "3600");
}

/**
 * Authenticated Firebase proxy for Azure OpenAI streaming chat completions.
 * Secrets remain server-side; validation, rate limiting, upstream access, and
 * SSE normalization are isolated under the chat module.
 */
export const chatProxy = onRequest(
  {
    secrets: [AZURE_OPENAI_API_KEY],
    cors: true,
    minInstances: MIN_INSTANCES,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (request, response): Promise<void> => {
    setCorsHeaders(response);
    logger.info("chatProxy invoked", {
      method: request.method,
      path: request.path,
      hasBody: Boolean(request.body),
    });

    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      logger.warn("405 method not allowed", { method: request.method });
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authentication = await authenticateBearer(request.headers.authorization);
    if (!authentication.ok) {
      if (authentication.reason === "missing") {
        logger.warn("401 missing bearer", {
          authHeaderLen: authentication.authHeaderLength,
        });
        response.status(401).json({ error: "Missing Authorization bearer token" });
        return;
      }

      logger.error("401 token verify failed", {
        errorMsg:
          authentication.error instanceof Error
            ? authentication.error.message
            : String(authentication.error),
        errorName:
          authentication.error instanceof Error ? authentication.error.name : "Unknown",
        tokenLen: authentication.tokenLength,
      });
      response.status(401).json({ error: "Invalid token" });
      return;
    }

    logger.info("ID token verified ok", { uid: authentication.uid });
    const rateLimit = await checkRateLimit(authentication.uid);
    if (!rateLimit.allowed) {
      logger.warn("429 rate limited", {
        uid: authentication.uid,
        retryAfterSec: rateLimit.retryAfterSec,
      });
      response.set("Retry-After", String(rateLimit.retryAfterSec));
      response.status(429).json({
        error: "Rate limit exceeded",
        retryAfterSec: rateLimit.retryAfterSec,
      });
      return;
    }

    const messages = sanitizeMessages(request.body?.messages);
    if (!messages) {
      logger.warn("400 invalid messages", {
        bodyType: typeof request.body,
        bodyKeys: request.body ? Object.keys(request.body) : [],
      });
      response.status(400).json({ error: "Invalid 'messages' payload" });
      return;
    }

    logger.info("messages ok", { count: messages.length, model: AZURE_MODEL.value() });

    let upstream: Response;
    try {
      upstream = await openAzureStream(messages);
    } catch (error) {
      const timeout = isUpstreamTimeout(error);
      logger.error("Failed to reach Azure OpenAI", {
        isTimeout: timeout,
        error: error instanceof Error ? error.message : String(error),
      });
      response
        .status(timeout ? 504 : 502)
        .json({ error: timeout ? "Upstream timeout" : "Upstream connection failed" });
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
      response.status(502).json({
        error: "Upstream error",
        status: upstream.status,
        detail: detail.slice(0, 300),
      });
      return;
    }

    logger.info("Azure stream opened ok", { status: upstream.status });
    response.set("Content-Type", "text/event-stream; charset=utf-8");
    response.set("Cache-Control", "no-cache, no-transform");
    response.set("Connection", "keep-alive");
    response.set("X-Accel-Buffering", "no");
    response.flushHeaders();

    await relayAzureSse(upstream, response);
  }
);
