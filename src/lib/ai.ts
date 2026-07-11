export class AIConfigError extends Error {
  constructor() {
    super(
      "AIプロバイダーが設定されていません。.env.local に ANTHROPIC_API_KEY または OPENAI_API_KEY を設定してください。"
    );
    this.name = "AIConfigError";
  }
}

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic APIから予期しない形式の応答がありました。");
  }
  return text;
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI API error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("OpenAI APIから予期しない形式の応答がありました。");
  }
  return text;
}

/** 設定されているプロバイダーでプロンプトを実行し、応答テキストを返す */
export async function runAI(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(prompt);
  }
  if (process.env.OPENAI_API_KEY) {
    return callOpenAI(prompt);
  }
  throw new AIConfigError();
}

/** モデル応答からJSON部分を抽出してパースする（コードフェンス等を許容） */
export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonSlice =
    start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonSlice) as T;
}
