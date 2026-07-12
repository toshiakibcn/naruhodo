export interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  ALLOWED_ORIGIN: string;
  WORKER_SECRET: string;
}

type TranslateMode = "translate" | "proofread";

type ImageInput = {
  dataUrl: string;
  mimeType: string;
};

type TranslateRequestBody = {
  mode: TranslateMode;
  text: string;
  targetLanguage: string;
  image?: ImageInput;
};

const LANGUAGE_LABELS: Record<string, string> = {
  ja: "日本語",
  en: "英語",
  ko: "韓国語",
  es: "スペイン語",
  pt: "ポルトガル語",
  fr: "フランス語",
  de: "ドイツ語",
  it: "イタリア語",
  ru: "ロシア語",
  "zh-CN": "簡体字中国語",
  "zh-TW": "繁体字中国語",
};

const AUTO_LANGUAGE = "auto";

function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code;
}

function targetInstruction(targetLanguage: string): string {
  return targetLanguage === AUTO_LANGUAGE
    ? "テキストが日本語の場合は英語に翻訳し、それ以外の言語の場合は日本語に翻訳してください。"
    : `「${languageLabel(targetLanguage)}」に翻訳してください。`;
}

function buildTranslatePrompt(text: string, targetLanguage: string): string {
  return `あなたは高精度な翻訳アシスタントです。次のテキストの言語を自動検出し、${targetInstruction(targetLanguage)}

テキスト:
"""
${text}
"""

以下のJSON形式のみで出力してください。前後に説明文やコードフェンスを付けないでください。

{
  "detectedLanguage": "検出した元言語の名前（日本語表記）",
  "translation": "自然で最も適切な訳文",
  "explanation": "翻訳のニュアンスや意訳のポイントについての簡潔な解説（日本語、2〜3文）",
  "alternatives": [
    { "tone": "カジュアル", "text": "カジュアルな言い回しの訳文" },
    { "tone": "フォーマル", "text": "フォーマルな言い回しの訳文" },
    { "tone": "ビジネス", "text": "ビジネスシーンに適した訳文" }
  ]
}

注意: alternativesはtranslationと意味が同じだが文体が異なる訳文にしてください。翻訳先の言語で書いてください。`;
}

function buildImageTranslatePrompt(targetLanguage: string): string {
  return `あなたは高精度な翻訳アシスタントです。この画像に写っているテキストを読み取り、言語を自動検出したうえで、${targetInstruction(targetLanguage)}

以下のJSON形式のみで出力してください。前後に説明文やコードフェンスを付けないでください。

{
  "sourceText": "画像から読み取った元のテキスト",
  "detectedLanguage": "検出した元言語の名前（日本語表記）",
  "translation": "自然で最も適切な訳文",
  "explanation": "翻訳のニュアンスや意訳のポイントについての簡潔な解説（日本語、2〜3文）",
  "alternatives": [
    { "tone": "カジュアル", "text": "カジュアルな言い回しの訳文" },
    { "tone": "フォーマル", "text": "フォーマルな言い回しの訳文" },
    { "tone": "ビジネス", "text": "ビジネスシーンに適した訳文" }
  ]
}

注意: 画像内にテキストが見つからない場合は、sourceTextとtranslationに「画像内にテキストが見つかりませんでした」と入れ、explanationにその旨を書き、alternativesは空配列にしてください。`;
}

function buildProofreadPrompt(text: string, targetLanguage: string): string {
  const instruction =
    targetLanguage === AUTO_LANGUAGE
      ? "次のテキストの言語を自動検出し、その言語のまま（他の言語に翻訳せず）誤字脱字や文法の誤りをチェックし、より自然な表現に添削してください。"
      : `次の「${languageLabel(targetLanguage)}」のテキストについて、誤字脱字や文法の誤りをチェックし、より自然な表現に添削してください。`;

  return `あなたは優秀な校正・添削アシスタントです。${instruction}

テキスト:
"""
${text}
"""

以下のJSON形式のみで出力してください。前後に説明文やコードフェンスを付けないでください。

{
  "detectedLanguage": "入力テキストの言語名（日本語表記）",
  "corrected": "添削後の自然なテキスト（元と同じ言語で）",
  "notes": ["修正点の簡潔な説明1（日本語）", "修正点の簡潔な説明2（日本語）"]
}

注意: 誤りがない場合はcorrectedに元のテキストをそのまま入れ、notesに「誤りは見つかりませんでした」の旨を1件だけ入れてください。`;
}

/** auto指定時、モデルが返したdetectedLanguageから実際に翻訳された言語を推定する */
function resolveTargetLanguage(targetLanguage: string, detectedLanguage: unknown): string {
  if (targetLanguage !== AUTO_LANGUAGE) return targetLanguage;
  return typeof detectedLanguage === "string" && detectedLanguage.includes("日本語") ? "en" : "ja";
}

class AIConfigError extends Error {}
class VisionUnsupportedError extends Error {}

function imageBase64(image: ImageInput): string {
  const commaIndex = image.dataUrl.indexOf(",");
  return commaIndex !== -1 ? image.dataUrl.slice(commaIndex + 1) : image.dataUrl;
}

async function callAnthropic(prompt: string, env: Env, image?: ImageInput): Promise<string> {
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
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1500,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Anthropic APIから予期しない形式の応答がありました。");
  return text;
}

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
    throw new VisionUnsupportedError(
      `${providerName}は画像の解析に対応していません。ANTHROPIC_API_KEYまたはOPENAI_API_KEYを設定してください。`
    );
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
    throw new Error(`${providerName} API error (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error(`${providerName} APIから予期しない形式の応答がありました。`);
  return text;
}

async function runAI(prompt: string, env: Env, image?: ImageInput): Promise<string> {
  if (env.ANTHROPIC_API_KEY) return callAnthropic(prompt, env, image);
  if (env.OPENAI_API_KEY) {
    return callOpenAICompatible(prompt, {
      providerName: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      supportsVision: true,
      image,
    });
  }
  if (env.DEEPSEEK_API_KEY) {
    return callOpenAICompatible(prompt, {
      providerName: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      supportsVision: false,
      image,
    });
  }
  throw new AIConfigError("AIプロバイダーが設定されていません。");
}

function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonSlice = start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonSlice) as T;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-worker-secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

function isImageInput(image: unknown): image is ImageInput {
  return (
    typeof image === "object" &&
    image !== null &&
    typeof (image as ImageInput).dataUrl === "string" &&
    typeof (image as ImageInput).mimeType === "string"
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get("origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN;
    const originOk = requestOrigin === allowedOrigin;
    const echoOrigin = originOk ? requestOrigin : allowedOrigin;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(echoOrigin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, echoOrigin);
    }

    if (!originOk) {
      return json({ error: "許可されていないオリジンです。" }, 403, echoOrigin);
    }

    const secret = request.headers.get("x-worker-secret");
    if (!env.WORKER_SECRET || secret !== env.WORKER_SECRET) {
      return json({ error: "認証に失敗しました。" }, 401, echoOrigin);
    }

    let body: TranslateRequestBody;
    try {
      body = await request.json();
    } catch {
      return json({ error: "リクエストの形式が不正です。" }, 400, echoOrigin);
    }

    const { mode, text, targetLanguage, image } = body;
    const hasImage = isImageInput(image);

    if (!hasImage && (!text || !text.trim())) {
      return json({ error: "テキストまたは画像を入力してください。" }, 400, echoOrigin);
    }
    if (mode !== "translate" && mode !== "proofread") {
      return json({ error: "modeが不正です。" }, 400, echoOrigin);
    }
    if (hasImage && mode !== "translate") {
      return json({ error: "画像は翻訳モードでのみ使用できます。" }, 400, echoOrigin);
    }
    if (!targetLanguage) {
      return json({ error: "翻訳先の言語を指定してください。" }, 400, echoOrigin);
    }

    const prompt = hasImage
      ? buildImageTranslatePrompt(targetLanguage)
      : mode === "translate"
        ? buildTranslatePrompt(text, targetLanguage)
        : buildProofreadPrompt(text, targetLanguage);

    try {
      const raw = await runAI(prompt, env, hasImage ? image : undefined);
      if (mode === "translate") {
        const parsed = extractJson<Record<string, unknown>>(raw);
        const resolvedTarget = resolveTargetLanguage(targetLanguage, parsed.detectedLanguage);
        return json({ mode: "translate", result: { ...parsed, targetLanguage: resolvedTarget } }, 200, echoOrigin);
      } else {
        const parsed = extractJson<Record<string, unknown>>(raw);
        return json({ mode: "proofread", result: parsed }, 200, echoOrigin);
      }
    } catch (err) {
      if (err instanceof AIConfigError || err instanceof VisionUnsupportedError) {
        return json({ error: err.message }, 503, echoOrigin);
      }
      const message = err instanceof Error ? err.message : "不明なエラーが発生しました。";
      return json({ error: `AIからの応答の取得に失敗しました: ${message}` }, 502, echoOrigin);
    }
  },
};
