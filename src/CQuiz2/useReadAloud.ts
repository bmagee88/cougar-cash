import { useCallback, useEffect, useRef, useState } from "react";

export const useReadAloud = (roundId: string, enabled: boolean) => {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;
  const [readingId, setReadingId] = useState("");
  const [speechError, setSpeechError] = useState("");
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (!current.current) return;
    current.current = null;
    window.speechSynthesis.cancel();
    setReadingId("");
  }, []);

  useEffect(() => stop, [roundId, stop]);

  const read = (id: string, text: string) => {
    if (!enabled || !supported) return;
    const wasReading = current.current !== null && readingId === id;
    stop();
    setSpeechError("");
    if (wasReading) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = document.documentElement.lang || "en-US";
      current.current = utterance;
      setReadingId(id);
      utterance.onend = () => {
        if (current.current !== utterance) return;
        current.current = null;
        setReadingId("");
      };
      utterance.onerror = () => {
        if (current.current !== utterance) return;
        current.current = null;
        setReadingId("");
        setSpeechError("Read aloud could not play. Try the speaker button again.");
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      current.current = null;
      setReadingId("");
      setSpeechError("Read aloud could not play. Try the speaker button again.");
    }
  };

  return { supported, readingId, speechError, read };
};
