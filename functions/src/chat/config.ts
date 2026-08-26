import { defineInt, defineSecret, defineString } from "firebase-functions/params";

export const AZURE_OPENAI_API_KEY = defineSecret("AZURE_OPENAI_API_KEY");
export const AZURE_MODEL = defineString("AZURE_MODEL", { default: "gpt-5-mini" });
export const MIN_INSTANCES = defineInt("CHAT_MIN_INSTANCES", { default: 0 });

export const AZURE_URL = "https://raiz.services.ai.azure.com/openai/v1/chat/completions";
export const MAX_MESSAGES = 12;
export const MAX_CHARS_PER_MESSAGE = 2000;
export const MAX_OUTPUT_TOKENS = 600;
export const UPSTREAM_TIMEOUT_MS = 90_000;
export const RATE_LIMIT_WINDOW_MIN = 60;
export const RATE_LIMIT_MAX_REQUESTS = 30;
