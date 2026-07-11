import { NextResponse } from "next/server";
import { AIConfigError, extractJson, runAI } from "@/lib/ai";
import { languageLabel } from "@/lib/languages";
import type {
  ProofreadResult,
  TranslateRequest,
  TranslateResult,
} from "@/lib/types";

export const runtime = "nodejs";

function buildTranslatePrompt(text: string, targetLanguage: string): string {
  const targetLabel = languageLabel(targetLanguage);
  return `あなたは高精度な翻訳アシスタントです。次のテキストの言語を自動検出し、「${targetLabel}」に翻訳してください。

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

function buildProofreadPrompt(text: string, targetLanguage: string): string {
  const targetLabel = languageLabel(targetLanguage);
  return `あなたは優秀な校正・添削アシスタントです。次の「${targetLabel}」のテキストについて、誤字脱字や文法の誤りをチェックし、より自然な表現に添削してください。

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

export async function POST(request: Request) {
  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { mode, text, targetLanguage } = body;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "テキストを入力してください。" }, { status: 400 });
  }
  if (mode !== "translate" && mode !== "proofread") {
    return NextResponse.json({ error: "modeが不正です。" }, { status: 400 });
  }
  if (!targetLanguage) {
    return NextResponse.json({ error: "翻訳先の言語を指定してください。" }, { status: 400 });
  }

  const prompt =
    mode === "translate"
      ? buildTranslatePrompt(text, targetLanguage)
      : buildProofreadPrompt(text, targetLanguage);

  try {
    const raw = await runAI(prompt);

    if (mode === "translate") {
      const parsed = extractJson<TranslateResult>(raw);
      return NextResponse.json({
        mode: "translate",
        result: { ...parsed, targetLanguage },
      });
    } else {
      const parsed = extractJson<ProofreadResult>(raw);
      return NextResponse.json({ mode: "proofread", result: parsed });
    }
  } catch (err) {
    if (err instanceof AIConfigError) {
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
