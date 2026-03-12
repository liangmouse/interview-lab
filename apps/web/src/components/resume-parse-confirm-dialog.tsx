"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info } from "lucide-react";

interface ResumeParseConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ResumeParseConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: ResumeParseConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            提示
          </AlertDialogTitle>
          <AlertDialogDescription>
            是否需要对简历附件进行解析并填充下方简历内容？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            否，仅做附件上传
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="cursor-pointer">
            是，需同步更新简历内容
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
