import { NextResponse } from "next/server";
import { AIConfigError, extractJson, runAI, VisionUnsupportedError } from "@/lib/ai";
import { AUTO_LANGUAGE, languageLabel } from "@/lib/languages";
import type {
  ImageInput,
  ProofreadResult,
  TranslateRequest,
  TranslateResult,
} from "@/lib/types";

export const runtime = "nodejs";

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
function resolveTargetLanguage(targetLanguage: string, detectedLanguage: string | undefined): string {
  if (targetLanguage !== AUTO_LANGUAGE) return targetLanguage;
  return detectedLanguage?.includes("日本語") ? "en" : "ja";
}

function isImageInput(image: unknown): image is ImageInput {
  return (
    typeof image === "object" &&
    image !== null &&
    typeof (image as ImageInput).dataUrl === "string" &&
    typeof (image as ImageInput).mimeType === "string"
  );
}

export async function POST(request: Request) {
  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { mode, text, targetLanguage, image } = body;
  const hasImage = isImageInput(image);

  if (!hasImage && (!text || !text.trim())) {
    return NextResponse.json({ error: "テキストまたは画像を入力してください。" }, { status: 400 });
  }
  if (mode !== "translate" && mode !== "proofread") {
    return NextResponse.json({ error: "modeが不正です。" }, { status: 400 });
  }
  if (hasImage && mode !== "translate") {
    return NextResponse.json({ error: "画像は翻訳モードでのみ使用できます。" }, { status: 400 });
  }
  if (!targetLanguage) {
    return NextResponse.json({ error: "翻訳先の言語を指定してください。" }, { status: 400 });
  }

  const prompt = hasImage
    ? buildImageTranslatePrompt(targetLanguage)
    : mode === "translate"
      ? buildTranslatePrompt(text, targetLanguage)
      : buildProofreadPrompt(text, targetLanguage);

  try {
    const raw = await runAI(prompt, hasImage ? image : undefined);

    if (mode === "translate") {
      const parsed = extractJson<TranslateResult>(raw);
      const resolvedTarget = resolveTargetLanguage(targetLanguage, parsed.detectedLanguage);
      return NextResponse.json({
        mode: "translate",
        result: { ...parsed, targetLanguage: resolvedTarget },
      });
    } else {
      const parsed = extractJson<ProofreadResult>(raw);
      return NextResponse.json({ mode: "proofread", result: parsed });
    }
  } catch (err) {
    if (err instanceof AIConfigError || err instanceof VisionUnsupportedError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました。";
    return NextResponse.json(
      { error: `AIからの応答の取得に失敗しました: ${message}` },
      { status: 502 }
    );
  }
}
