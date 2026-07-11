"use client";

import type { TranslateApiResponse, TranslateMode } from "./types";

const STORAGE_KEY = "nani-clone:history";
const MAX_ITEMS = 30;

export type HistoryItem = {
  id: string;
  mode: TranslateMode;
  sourceText: string;
  targetLanguage: string;
  response: TranslateApiResponse;
  createdAt: number;
};

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: HistoryItem): HistoryItem[] {
  const current = loadHistory();
  const next = [item, ...current].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ストレージ容量超過時は履歴保存をスキップ
  }
  return next;
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
