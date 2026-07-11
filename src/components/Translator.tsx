"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import {
  clearHistory,
  loadHistory,
  saveHistoryItem,
  type HistoryItem,
} from "@/lib/history";
import type {
  TranslateApiError,
  TranslateApiResponse,
  TranslateMode,
} from "@/lib/types";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Translator() {
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [loading, setLoading] = useState<TranslateMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TranslateApiResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // localStorageはサーバーで読めないため、マウント後にクライアント側で読み込む
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  async function runRequest(mode: TranslateMode) {
    if (!text.trim() || loading) return;
    setLoading(mode);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, text, targetLanguage }),
      });
      const data: TranslateApiResponse | TranslateApiError = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "翻訳に失敗しました。");
      }
      setResponse(data);
      const item: HistoryItem = {
        id: newId(),
        mode,
        sourceText: text,
        targetLanguage,
        response: data,
        createdAt: Date.now(),
      };
      setHistory(saveHistoryItem(item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "翻訳に失敗しました。");
    } finally {
      setLoading(null);
    }
  }

  function startNew() {
    setText("");
    setResponse(null);
    setError(null);
  }

  function restoreHistoryItem(item: HistoryItem) {
    setText(item.sourceText);
    setTargetLanguage(item.targetLanguage);
    setResponse(item.response);
    setError(null);
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // クリップボードが使えない環境では無視
    }
  }

  return (
    <div className="flex flex-1 w-full flex-col md:flex-row bg-zinc-50 dark:bg-black">
      {/* サイドバー */}
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-4">
        <button
          onClick={startNew}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          ✎ 新規翻訳
        </button>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-xs leading-relaxed text-blue-900 dark:text-blue-200">
          🔒 翻訳データはこの端末上に保存され、サーバーには保存されません。
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-zinc-500">履歴</span>
            {history.length > 0 && (
              <button
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                クリア
              </button>
            )}
          </div>
          {history.length === 0 && (
            <p className="px-1 text-xs text-zinc-400">まだ履歴はありません</p>
          )}
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => restoreHistoryItem(item)}
              className="text-left rounded-md px-2 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 truncate"
              title={item.sourceText}
            >
              {item.sourceText.slice(0, 24) || "（空）"}
            </button>
          ))}
        </div>
      </aside>

      {/* メイン */}
      <main className="flex-1 flex flex-col items-center px-4 py-10 gap-8">
        {!response && (
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo size={64} />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Naruhodo!
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              AIが「なるほど」まで届ける翻訳
            </p>
          </div>
        )}

        <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">
              AIが言語を検出し、翻訳先の言語に翻訳します
            </span>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="翻訳したいテキストを入力..."
            rows={5}
            className="w-full resize-none bg-transparent px-4 py-3 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => runRequest("proofread")}
              disabled={!text.trim() || loading !== null}
              className="rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading === "proofread" ? "添削中…" : "添削する"}
            </button>
            <button
              onClick={() => runRequest("translate")}
              disabled={!text.trim() || loading !== null}
              className="rounded-full bg-blue-500 px-5 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading === "translate" ? "翻訳中…" : "翻訳する ↑"}
            </button>
          </div>
        </div>

        {error && (
          <div className="w-full max-w-2xl rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {response?.mode === "translate" && (
          <div className="w-full max-w-2xl flex flex-col gap-4">
            <ResultCard
              label={`翻訳結果（${languageLabel(response.result.targetLanguage)} ・ 元言語: ${response.result.detectedLanguage}）`}
              onCopy={() => copyText(response.result.translation, "translation")}
              copied={copied === "translation"}
            >
              <p className="whitespace-pre-wrap text-lg text-zinc-900 dark:text-zinc-100">
                {response.result.translation}
              </p>
            </ResultCard>

            <ResultCard label="解説">
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
                {response.result.explanation}
              </p>
            </ResultCard>

            {response.result.alternatives?.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-1">
                {response.result.alternatives.map((alt, i) => (
                  <ResultCard
                    key={i}
                    label={`トーン: ${alt.tone}`}
                    onCopy={() => copyText(alt.text, `alt-${i}`)}
                    copied={copied === `alt-${i}`}
                  >
                    <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                      {alt.text}
                    </p>
                  </ResultCard>
                ))}
              </div>
            )}
          </div>
        )}

        {response?.mode === "proofread" && (
          <div className="w-full max-w-2xl flex flex-col gap-4">
            <ResultCard
              label={`添削結果（${response.result.detectedLanguage}）`}
              onCopy={() => copyText(response.result.corrected, "corrected")}
              copied={copied === "corrected"}
            >
              <p className="whitespace-pre-wrap text-lg text-zinc-900 dark:text-zinc-100">
                {response.result.corrected}
              </p>
            </ResultCard>

            <ResultCard label="修正ポイント">
              <ul className="list-disc pl-5 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
                {response.result.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </ResultCard>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultCard({
  label,
  children,
  onCopy,
  copied,
}: {
  label: string;
  children: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-500">{label}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
