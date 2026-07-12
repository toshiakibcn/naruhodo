import type { ImageInput } from "./types";

export class AIConfigError extends Error {
  constructor() {
    super(
      "AIプロバイダーが設定されていません。.env.local に ANTHROPIC_API_KEY・OPENAI_API_KEY・DEEPSEEK_API_KEY のいずれかを設定してください。"
    );
    this.name = "AIConfigError";
  }
}

export class VisionUnsupportedError extends Error {
  constructor(providerName: string) {
    super(`${providerName}は画像の解析に対応していません。ANTHROPIC_API_KEYまたはOPENAI_API_KEYを設定してください。`);
    this.name = "VisionUnsupportedError";
  }
}

function imageBase64(image: ImageInput): string {
  const commaIndex = image.dataUrl.indexOf(",");
  return commaIndex !== -1 ? image.dataUrl.slice(commaIndex + 1) : image.dataUrl;
}

async function callAnthropic(prompt: string, image?: ImageInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const content: unknown[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mimeType, data: imageBase64(image) },
    });
  }
  content.push({ type: "text", text: prompt });

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
      messages: [{ role: "user", content }],
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

/** OpenAI互換のChat Completions APIを叩く共通処理（OpenAI / DeepSeek） */
async function callOpenAICompatible(
  prompt: string,
  {
    providerName,
    baseUrl,
    apiKey,
    model,
    supportsVision,
    image,
  }: {
    providerName: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    supportsVision: boolean;
    image?: ImageInput;
  }
): Promise<string> {
  if (image && !supportsVision) {
    throw new VisionUnsupportedError(providerName);
  }

  const content: unknown = image
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: image.dataUrl } },
      ]
    : prompt;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${providerName} API error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error(`${providerName} APIから予期しない形式の応答がありました。`);
  }
  return text;
}

function callOpenAI(prompt: string, image?: ImageInput): Promise<string> {
  return callOpenAICompatible(prompt, {
    providerName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    supportsVision: true,
    image,
  });
}

function callDeepSeek(prompt: string, image?: ImageInput): Promise<string> {
  return callOpenAICompatible(prompt, {
    providerName: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY!,
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    supportsVision: false,
    image,
  });
}

/** 設定されているプロバイダーでプロンプトを実行し、応答テキストを返す。imageを渡すと画像入力として送信する */
export async function runAI(prompt: string, image?: ImageInput): Promise<string> {
  if (image) {
    // 画像はDeepSeekが非対応のため、OpenAIを優先し、次点でAnthropicを使う
    if (process.env.OPENAI_API_KEY) {
      return callOpenAI(prompt, image);
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return callAnthropic(prompt, image);
    }
    throw new VisionUnsupportedError(process.env.DEEPSEEK_API_KEY ? "DeepSeek" : "設定されているプロバイダー");
  }

  // テキストはDeepSeekが使えるなら優先する（コストが低いため）
  if (process.env.DEEPSEEK_API_KEY) {
    return callDeepSeek(prompt);
  }
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
