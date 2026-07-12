export type TranslateMode = "translate" | "proofread";

export type ImageInput = {
  dataUrl: string; // "data:image/png;base64,...."
  mimeType: string;
};

export type TranslateRequest = {
  mode: TranslateMode;
  text: string;
  targetLanguage: string; // language code, e.g. "en"
  image?: ImageInput;
};

export type ToneVariant = {
  tone: string;
  text: string;
};

export type TranslateResult = {
  detectedLanguage: string;
  targetLanguage: string;
  translation: string;
  explanation: string;
  alternatives: ToneVariant[];
  sourceText?: string; // 画像から読み取った元テキスト（画像翻訳時のみ）
};

export type ProofreadResult = {
  detectedLanguage: string;
  corrected: string;
  notes: string[];
};

export type TranslateApiResponse =
  | { mode: "translate"; result: TranslateResult }
  | { mode: "proofread"; result: ProofreadResult };

export type TranslateApiError = { error: string };
