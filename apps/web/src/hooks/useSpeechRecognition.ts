import { useState, useRef, useCallback, useEffect } from "react";

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
}

/**
 * 语音识别 Hook - 基于 Web Speech API
 * 支持中文语音识别，实时转录用户语音输入
 */
export function useSpeechRecognition({
  onResult,
  onError,
  continuous = true,
  interimResults = true,
  language = "zh-CN",
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const autoRestartRef = useRef(false);

  // 检查浏览器支持
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsSupported(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;

      // 配置语音识别
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      // 处理识别结果
      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // 更新最终转录结果
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript;
          setTranscript(finalTranscriptRef.current);
          onResult?.(finalTranscriptRef.current);
        }

        // 更新临时转录结果
        setInterimTranscript(interimTranscript);
      };

      // 处理错误
      recognition.onerror = (event) => {
        // 对于无语音输入/不匹配，不作为错误处理，保持等待
        if (
          event.error === "no-speech" ||
          (event as any).error === "no-match"
        ) {
          return;
        }
        const errorMessage = getErrorMessage(event.error);
        setError(errorMessage);
        autoRestartRef.current = false;
        setIsListening(false);
        onError?.(errorMessage);
        console.error("语音识别错误:", event.error);
      };

      // 处理开始
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      // 处理结束
      recognition.onend = () => {
        // 静默等自然结束时，如果开启自动重启，则继续监听
        if (autoRestartRef.current) {
          try {
            recognition.start();
            return;
          } catch {}
        }
        setIsListening(false);
      };
    }
  }, [continuous, interimResults, language, onResult, onError]);

  // 开始语音识别
  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      setError("浏览器不支持语音识别");
      return;
    }

    if (isListening) {
      return;
    }

    try {
      setError(null);
      autoRestartRef.current = true;
      recognitionRef.current.start();
    } catch (err) {
      setError("启动语音识别失败");
      console.error("启动语音识别失败:", err);
    }
  }, [isListening, isSupported]);

  // 停止语音识别
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      autoRestartRef.current = false;
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // 重置转录结果
  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
    setError(null);
  }, []);

  // 清理资源
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}

/**
 * 获取语音识别错误信息
 */
function getErrorMessage(error: string): string {
  switch (error) {
    case "no-speech":
      return "未检测到语音输入";
    case "audio-capture":
      return "无法访问麦克风";
    case "not-allowed":
      return "麦克风权限被拒绝";
    case "network":
      return "网络连接错误";
    case "aborted":
      return "语音识别被中断";
    case "language-not-supported":
      return "不支持当前语言";
    default:
      return "语音识别出现未知错误";
  }
}

// 扩展 Window 接口以支持语音识别
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
