import {
  AZURE_MODEL,
  AZURE_OPENAI_API_KEY,
  AZURE_URL,
  MAX_OUTPUT_TOKENS,
  UPSTREAM_TIMEOUT_MS,
} from './config';
import type { ChatMessage } from './validation';

export async function openAzureStream(messages: ChatMessage[]): Promise<Response> {
  return fetch(AZURE_URL, {
    method: 'POST',
    headers: {
      'api-key': AZURE_OPENAI_API_KEY.value(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AZURE_MODEL.value(),
      messages,
      stream: true,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      reasoning_effort: 'low',
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

export const isUpstreamTimeout = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
