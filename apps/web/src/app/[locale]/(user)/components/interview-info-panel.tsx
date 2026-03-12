"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Pause } from "lucide-react";

interface InterviewInfoPanelProps {
  isLoading: boolean;
  isVoiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  elapsedTime: string;
  interactionCount: number;
  onRestart: () => void;
  onStop: () => void;
  isRecording: boolean;
}

export function InterviewInfoPanel({
  isLoading,
  isVoiceMode,
  isListening,
  isSpeaking,
  elapsedTime,
  interactionCount,
  onRestart,
  onStop,
  isRecording,
}: InterviewInfoPanelProps) {
  return (
    <div className="w-60 flex flex-col">
      <Card className="backdrop-blur-md bg-white/60 border-white/30 shadow-xl rounded-3xl overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <div className="relative inline-block">
              <Avatar className="w-24 h-24 mx-auto mb-3 ring-4 ring-sky-200/50">
                <AvatarImage src="/placeholder.svg?height=96&width=96" />
                <AvatarFallback className="bg-gradient-to-r from-sky-400 to-purple-400 text-white text-6xl">
                  🥸
                </AvatarFallback>
              </Avatar>
              {isLoading && (
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-gray-800">小面 AI面试官</h3>
            <p className="text-sm text-gray-600">专业 · 友善 · 耐心</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl">
              <span className="text-sm text-gray-600">面试模式</span>
              <Badge
                variant="secondary"
                className={
                  isVoiceMode
                    ? "bg-green-100 text-green-700"
                    : "bg-sky-100 text-sky-700"
                }
              >
                {isVoiceMode ? "语音模式" : "文本模式"}
              </Badge>
            </div>
            {isVoiceMode && (
              <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl">
                <span className="text-sm text-gray-600">语音状态</span>
                <div className="flex items-center space-x-2">
                  {isListening && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                  {isSpeaking && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                  <span className="text-xs text-gray-500">
                    {isListening ? "正在听" : isSpeaking ? "正在说" : "待机"}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl">
              <span className="text-sm text-gray-600">已进行</span>
              <span className="text-sm font-medium text-gray-800">
                {elapsedTime}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl">
              <span className="text-sm text-gray-600">互动次数</span>
              <span className="text-sm font-medium text-gray-800">
                {interactionCount}次
              </span>
            </div>
          </div>

          <div className="flex space-x-2 mt-4">
            <motion.div
              className="flex-1"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
            >
              <Button
                onClick={onRestart}
                variant="outline"
                size="sm"
                className="w-full rounded-2xl border-sky-200 hover:bg-sky-50 bg-transparent"
                disabled={isLoading}
              >
                <motion.div
                  animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
                  transition={{
                    duration: 1,
                    repeat: isLoading ? Infinity : 0,
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                </motion.div>
                重新开始
              </Button>
            </motion.div>
            <motion.div
              className="flex-1"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
            >
              <Button
                onClick={onStop}
                variant="outline"
                size="sm"
                className="w-full rounded-2xl border-purple-200 hover:bg-purple-50 bg-transparent cursor-pointer"
                disabled={
                  isVoiceMode ? !isRecording && !isSpeaking : !isLoading
                }
              >
                <Pause className="w-4 h-4 mr-1" />
                暂停
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
