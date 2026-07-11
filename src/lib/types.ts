export type TranslateMode = "translate" | "proofread";

export type TranslateRequest = {
  mode: TranslateMode;
  text: string;
  targetLanguage: string; // language code, e.g. "en"
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
