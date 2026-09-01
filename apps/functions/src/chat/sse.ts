import * as logger from 'firebase-functions/logger';
import { isUpstreamTimeout } from './azure';

interface StreamResponse {
  write: (chunk: string) => unknown;
  end: () => unknown;
}

export async function relayAzureSse(upstream: Response, response: StreamResponse): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  const send = (payload: string): void => {
    response.write(`data: ${payload}\n\n`);
  };

  try {
    for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '' || data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const delta: string | undefined = json?.choices?.[0]?.delta?.content;
            if (delta) send(JSON.stringify({ content: delta }));
          } catch {
            // Ignore malformed or keep-alive events without terminating stream.
          }
        }
      }
    }
  } catch (error) {
    const timeout = isUpstreamTimeout(error);
    logger.error('Stream interrupted', {
      isTimeout: timeout,
      error: error instanceof Error ? error.message : String(error),
    });
    send(JSON.stringify({ error: timeout ? 'stream_timeout' : 'stream_interrupted' }));
  } finally {
    response.write('data: [DONE]\n\n');
    response.end();
  }
}
