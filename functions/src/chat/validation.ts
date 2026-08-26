import { MAX_CHARS_PER_MESSAGE, MAX_MESSAGES } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const messages: ChatMessage[] = [];
  for (const raw of input.slice(-MAX_MESSAGES)) {
    if (!raw || typeof raw !== "object") return null;

    const role = (raw as ChatMessage).role;
    const content = (raw as ChatMessage).content;
    if (role !== "system" && role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length === 0) return null;

    messages.push({ role, content: content.slice(0, MAX_CHARS_PER_MESSAGE) });
  }

  return messages;
}
