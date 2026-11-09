import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API hook for voice prompting Pip.
 * @param {Function} onTranscript Callback received with transcribed text
 */
export function useSpeech(onTranscript) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SpeechRecognition) {
      setSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; ++i) {
          text += e.results[i][0].transcript;
        }
        if (text) {
          onTranscript?.(text);
        }
      };

      rec.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
      };

      recRef.current = rec;
    }
  }, [onTranscript]);

  const toggle = useCallback(() => {
    if (!recRef.current) return;
    if (listening) {
      try {
        recRef.current.stop();
      } catch {}
      setListening(false);
    } else {
      try {
        recRef.current.start();
        setListening(true);
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
        setListening(false);
      }
    }
  }, [listening]);

  return { listening, supported, toggle };
}
