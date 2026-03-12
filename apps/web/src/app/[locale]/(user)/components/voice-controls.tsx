"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Phone, Pause, Mic, MicOff } from "lucide-react";

interface VoiceControlsProps {
  isVoiceMode: boolean;
  isSpeaking: boolean;
  isRecording: boolean;
  isLoading: boolean;
  onVoiceModeToggle: () => void;
  onStopTTS: () => void;
  onToggleRecording: () => void;
}

export function VoiceControls({
  isVoiceMode,
  isSpeaking,
  isRecording,
  isLoading,
  onVoiceModeToggle,
  onStopTTS,
  onToggleRecording,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center space-x-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
              <Button
                onClick={onVoiceModeToggle}
                variant="outline"
                size="lg"
                className="rounded-2xl"
                disabled={isLoading}
              >
                <Phone className="w-5 h-5" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>切换到语音对话模式</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isVoiceMode && isSpeaking && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
              >
                <Button
                  onClick={onStopTTS}
                  variant="destructive"
                  size="lg"
                  className="rounded-2xl"
                >
                  <Pause className="w-5 h-5" />
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>打断AI说话</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              animate={isRecording ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={{
                duration: 0.5,
                repeat: isRecording ? Infinity : 0,
              }}
            >
              <Button
                onClick={onToggleRecording}
                variant={isRecording ? "destructive" : "outline"}
                size="lg"
                className="rounded-2xl"
                disabled={isLoading}
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isRecording
                ? "停止录音"
                : isVoiceMode
                  ? "开始录音"
                  : "请先切换到语音模式"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
