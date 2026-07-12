export type Language = {
  code: string;
  label: string;
};

export const AUTO_LANGUAGE = "auto";

export const LANGUAGES: Language[] = [
  { code: "auto", label: "自動（日⇄英）" },
  { code: "ja", label: "日本語" },
  { code: "en", label: "英語" },
  { code: "ko", label: "韓国語" },
  { code: "es", label: "スペイン語" },
  { code: "pt", label: "ポルトガル語" },
  { code: "fr", label: "フランス語" },
  { code: "de", label: "ドイツ語" },
  { code: "it", label: "イタリア語" },
  { code: "ru", label: "ロシア語" },
  { code: "zh-CN", label: "簡体字中国語" },
  { code: "zh-TW", label: "繁体字中国語" },
];

export const TONES = [
  { id: "neutral", label: "標準" },
  { id: "casual", label: "カジュアル" },
  { id: "formal", label: "フォーマル" },
  { id: "business", label: "ビジネス" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
