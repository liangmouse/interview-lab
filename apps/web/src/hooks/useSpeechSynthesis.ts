import { useState, useRef, useCallback, useEffect } from "react";

interface UseSpeechSynthesisOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: string;
  voice?: SpeechSynthesisVoice | null;
}

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  error: string | null;
}

/**
 * 语音合成 Hook - 基于 Web Speech API
 * 支持中文语音合成，将AI回应转换为语音播放
 */
export function useSpeechSynthesis({
  onStart,
  onEnd,
  onError,
  rate = 0.9,
  pitch = 1.0,
  volume = 1.0,
  language = "zh-CN",
  voice,
}: UseSpeechSynthesisOptions = {}): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // 检查浏览器支持并加载语音列表
  useEffect(() => {
    setIsSupported("speechSynthesis" in window);

    if ("speechSynthesis" in window) {
      // 加载可用语音
      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);

        // 自动选择中文语音
        if (!voice && availableVoices.length > 0) {
          const chineseVoice = availableVoices.find(
            (v) => v.lang.startsWith("zh") || v.lang.includes("Chinese"),
          );
          if (chineseVoice) {
            currentVoiceRef.current = chineseVoice;
          }
        }
      };

      // 初始加载
      loadVoices();

      // 监听语音列表变化
      speechSynthesis.addEventListener("voiceschanged", loadVoices);

      return () => {
        speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      };
    }
  }, [voice]);

  // 更新当前语音
  useEffect(() => {
    if (voice) {
      currentVoiceRef.current = voice;
    }
  }, [voice]);

  // 语音合成
  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        setError("浏览器不支持语音合成");
        return;
      }

      // 停止当前播放
      if (isSpeaking) {
        speechSynthesis.cancel();
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // 设置语音参数
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        utterance.lang = language;

        // 设置语音
        if (currentVoiceRef.current) {
          utterance.voice = currentVoiceRef.current;
        }

        // 事件监听
        utterance.onstart = () => {
          setIsSpeaking(true);
          setError(null);
          onStart?.();
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          onEnd?.();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          const errorMessage = getErrorMessage(event.error);
          setError(errorMessage);
          onError?.(errorMessage);
          console.error("语音合成错误:", event.error);
        };

        utterance.onpause = () => {
          setIsSpeaking(false);
        };

        utterance.onresume = () => {
          setIsSpeaking(true);
        };

        // 开始播放
        speechSynthesis.speak(utterance);
      } catch (err) {
        setError("语音合成失败");
        console.error("语音合成失败:", err);
      }
    },
    [
      isSupported,
      rate,
      pitch,
      volume,
      language,
      isSpeaking,
      onStart,
      onEnd,
      onError,
    ],
  );

  // 停止播放
  const stop = useCallback(() => {
    if (isSupported) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // 暂停播放
  const pause = useCallback(() => {
    if (isSupported && isSpeaking) {
      speechSynthesis.pause();
    }
  }, [isSupported, isSpeaking]);

  // 恢复播放
  const resume = useCallback(() => {
    if (isSupported && !isSpeaking) {
      speechSynthesis.resume();
    }
  }, [isSupported, isSpeaking]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (isSupported) {
        speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
    isSupported,
    voices,
    error,
  };
}

/**
 * 获取语音合成错误信息
 */
function getErrorMessage(error: string): string {
  switch (error) {
    case "network":
      return "网络连接错误";
    case "synthesis-unavailable":
      return "语音合成服务不可用";
    case "synthesis-failed":
      return "语音合成失败";
    case "language-unavailable":
      return "不支持当前语言";
    case "voice-unavailable":
      return "语音不可用";
    case "text-too-long":
      return "文本过长";
    case "invalid-argument":
      return "无效参数";
    case "not-allowed":
      return "语音合成被拒绝";
    default:
      return "语音合成出现未知错误";
  }
}

/**
 * 获取中文语音列表
 */
export function getChineseVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  return speechSynthesis
    .getVoices()
    .filter(
      (voice) => voice.lang.startsWith("zh") || voice.lang.includes("Chinese"),
    );
}

/**
 * 获取最佳中文语音
 */
export function getBestChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  const chineseVoices = getChineseVoices();

  if (chineseVoices.length === 0) {
    return null;
  }

  // 优先选择中国大陆的语音
  const mainlandVoice = chineseVoices.find(
    (voice) => voice.lang === "zh-CN" || voice.lang === "zh-Hans-CN",
  );

  if (mainlandVoice) {
    return mainlandVoice;
  }

  // 其次选择简体中文
  const simplifiedVoice = chineseVoices.find(
    (voice) => voice.lang.includes("Hans") || voice.lang.includes("Simplified"),
  );

  if (simplifiedVoice) {
    return simplifiedVoice;
  }

  // 最后返回第一个中文语音
  return chineseVoices[0];
}
