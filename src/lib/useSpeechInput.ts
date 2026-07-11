"use client";

import { useEffect, useRef, useState } from "react";

type UseSpeechInputOptions = {
  onTranscriptChange: (fullText: string) => void;
  getBaseText: () => string;
};

/** ブラウザのWeb Speech APIを使った音声入力。テキストは呼び出し側のonTranscriptChangeへ随時反映する */
export function useSpeechInput({
  onTranscriptChange,
  getBaseText,
}: UseSpeechInputOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      // ブラウザ対応状況はサーバー側では判定できないため、マウント後にクライアントで判定する
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      const base = baseTextRef.current;
      const sep = base && !/[\s\n]$/.test(base) ? " " : "";
      onTranscriptChange(base + sep + finalTranscriptRef.current + interim);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }

    baseTextRef.current = getBaseText();
    finalTranscriptRef.current = "";
    recognition.start();
    setListening(true);
  }

  return { listening, supported, toggleListening };
}
