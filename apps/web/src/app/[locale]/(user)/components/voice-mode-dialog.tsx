"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VoiceModeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
}

export function VoiceModeDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: VoiceModeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>切换到语音对话模式？</DialogTitle>
          <DialogDescription>
            切换后将开启实时语音对话，这将提供更流畅的面试体验。您准备好开始了吗？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
