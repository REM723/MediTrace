// Thin OpenAI-compatible chat wrapper (NFR-8: swap Groq for any compatible
// provider by changing base URL + key, no call-site changes). Server-only:
// reads GROQ_API_KEY / GROQ_MODEL_ID, which must never reach the browser.

const BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function modelId(): string {
  // Model ID is config, never hardcoded (IR-4): the Groq catalogue changes.
  // TODO: verify the value in GROQ_MODEL_ID is still current in the Groq
  // catalogue at deploy time; default to a Llama 3.3 70B instruct class model.
  return process.env.GROQ_MODEL_ID ?? "llama-3.3-70b-versatile";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Returns the raw assistant text. Low temperature + JSON object mode (IR-4).
// Retries on rate limits, 5xx, and network errors with exponential backoff
// (NFR-3); 4xx other than 429 fail fast since retrying won't help.
export async function chatJson(messages: ChatMessage[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const body = JSON.stringify({
    model: modelId(),
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body,
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Groq returned no content");
        return content;
      }

      const retryable = res.status === 429 || res.status >= 500;
      const detail = await res.text().catch(() => "");
      const err = new Error(`Groq request failed (${res.status}): ${detail.slice(0, 300)}`);
      if (!retryable || attempt === maxAttempts) throw err;
      lastErr = err;
      // Honour Retry-After when present, else exponential backoff.
      const retryAfter = Number(res.headers.get("retry-after")) * 1000;
      await sleep(retryAfter > 0 ? retryAfter : 2 ** attempt * 500);
    } catch (err) {
      // Network/transport error: retry unless it was our own thrown HTTP error.
      if (err instanceof Error && err.message.startsWith("Groq request failed")) throw err;
      lastErr = err;
      if (attempt === maxAttempts) break;
      await sleep(2 ** attempt * 500);
    }
  }
  throw lastErr ?? new Error("Groq request failed");
}
