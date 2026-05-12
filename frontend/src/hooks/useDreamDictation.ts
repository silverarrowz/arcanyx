import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

type SpeechModuleShape = {
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getPermissionsAsync: () => Promise<{ granted: boolean }>;
};

type SpeechEventName =
  | "result"
  | "error"
  | "end"
  | "start"
  | "speechstart"
  | "speechend"
  | "audioend";

type SpeechModuleApi = {
  ExpoSpeechRecognitionModule: SpeechModuleShape;
  useSpeechRecognitionEvent: <T = unknown>(
    name: SpeechEventName,
    listener: (event: T) => void,
  ) => void;
};

/**
 * Loaded once at module init. If the native module isn't linked (e.g. running in
 * Expo Go), the require throws and we fall back to a "not available" state.
 */
function loadSpeechModule(): SpeechModuleApi | null {
  try {
    // Dynamic require so the bundle still works in Expo Go (where the native
    // module isn't linked) and we can degrade to "not available" instead of crashing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition") as SpeechModuleApi;
    if (
      mod &&
      typeof mod.ExpoSpeechRecognitionModule?.start === "function" &&
      typeof mod.useSpeechRecognitionEvent === "function"
    ) {
      return mod;
    }
    return null;
  } catch {
    return null;
  }
}

const speechApi = loadSpeechModule();

const DEFAULT_LOCALE = "ru-RU";

export type DreamDictationState = {
  isAvailable: boolean;
  isListening: boolean;
  partialTranscript: string;
  error: string | null;
};

export type DreamDictationControls = DreamDictationState & {
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
  resetError: () => void;
};

export type UseDreamDictationOptions = {
  /** BCP-47 locale, default "ru-RU". */
  locale?: string;
  /** Called whenever a final transcript is produced — append to existing text. */
  onFinalTranscript: (text: string) => void;
};

const noopUseSpeechEvent: SpeechModuleApi["useSpeechRecognitionEvent"] = () => {};

export function useDreamDictation({
  locale = DEFAULT_LOCALE,
  onFinalTranscript,
}: UseDreamDictationOptions): DreamDictationControls {
  const isAvailable = speechApi !== null && Platform.OS !== "web";

  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const useEvent = speechApi?.useSpeechRecognitionEvent ?? noopUseSpeechEvent;

  useEvent<{
    isFinal: boolean;
    results: { transcript: string }[];
  }>("result", (event) => {
    const transcript = event.results?.[0]?.transcript ?? "";
    if (event.isFinal) {
      if (transcript.trim().length > 0) {
        onFinalTranscriptRef.current(transcript);
      }
      setPartialTranscript("");
    } else {
      setPartialTranscript(transcript);
    }
  });

  useEvent<{ error: string; message: string }>("error", (event) => {
    setIsListening(false);
    setPartialTranscript("");
    setError(humanizeError(event.error, event.message));
  });

  useEvent<null>("end", () => {
    setIsListening(false);
    setPartialTranscript("");
  });

  const start = useCallback(async () => {
    if (!speechApi) {
      setError(
        "Распознавание речи недоступно в Expo Go. Используйте dev build.",
      );
      return;
    }
    setError(null);

    try {
      const current = await speechApi.ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!current.granted) {
        const requested = await speechApi.ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!requested.granted) {
          setError("Нет доступа к микрофону или распознаванию речи.");
          return;
        }
      }

      speechApi.ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        maxAlternatives: 1,
      });
      setIsListening(true);
      setPartialTranscript("");
    } catch (e) {
      setIsListening(false);
      setError(
        e instanceof Error ? e.message : "Не удалось запустить запись.",
      );
    }
  }, [locale]);

  const stop = useCallback(() => {
    if (!speechApi) return;
    try {
      speechApi.ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignored — `end` event will reset state
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isListening) {
      stop();
    } else {
      await start();
    }
  }, [isListening, start, stop]);

  const resetError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      if (speechApi && isListening) {
        try {
          speechApi.ExpoSpeechRecognitionModule.abort();
        } catch {
          // ignore on unmount
        }
      }
    };
  }, [isListening]);

  return {
    isAvailable,
    isListening,
    partialTranscript,
    error,
    start,
    stop,
    toggle,
    resetError,
  };
}

function humanizeError(code: string, message: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Нет доступа. Разрешите микрофон и распознавание речи в настройках.";
    case "no-speech":
    case "speech-timeout":
      return "Мы вас не услышали. Попробуйте ещё раз.";
    case "language-not-supported":
      return "Этот язык не поддерживается распознаванием на устройстве.";
    case "network":
      return "Нет соединения с распознавателем. Проверьте интернет.";
    case "audio-capture":
      return "Не удалось получить звук с микрофона.";
    case "busy":
      return "Распознаватель занят. Попробуйте через секунду.";
    default:
      return message?.trim() || "Ошибка распознавания речи.";
  }
}
