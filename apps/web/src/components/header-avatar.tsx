"use client";

import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, Upload } from "lucide-react";
import { uploadAvatar } from "@/action/upload-avatar";
import { useUserStore } from "@/store/user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HeaderAvatarProps {
  avatarUrl?: string | null;
  userName: string;
  className?: string;
}

export function HeaderAvatar({
  avatarUrl,
  userName,
  className,
}: HeaderAvatarProps) {
  const { userInfo, setUserInfo } = useUserStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tempPreview, setTempPreview] = useState<string | null>(null);

  // 确定显示的头像 URL：优先使用 userInfo 中的最新值，其次使用传入的 avatarUrl
  const displayAvatarUrl =
    userInfo?.avatar_url || avatarUrl || "/placeholder.svg";

  // 清理临时预览 URL 的 effect（当组件卸载或对话框关闭时）
  useEffect(() => {
    return () => {
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
      }
    };
  }, [tempPreview]);

  // 处理文件选择
  // 验证逻辑由 server action 处理，这里只负责文件选择和预览
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // 创建临时预览 URL
      const previewUrl = URL.createObjectURL(file);
      setTempPreview(previewUrl);
    }
  };

  // 处理头像上传
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("请先选择一张图片");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await uploadAvatar(formData);

      if (result.success && result.data) {
        const newAvatarUrl = result.data.avatar_url;

        // 更新全局状态
        if (result.data.profile) {
          setUserInfo(result.data.profile);
        } else if (userInfo) {
          // 如果 server action 没有返回完整的 profile，至少更新 avatar_url
          const updatedUserInfo = {
            ...userInfo,
            avatar_url: newAvatarUrl,
          };
          setUserInfo(updatedUserInfo);
        }

        // 清理临时预览 URL
        if (tempPreview) {
          URL.revokeObjectURL(tempPreview);
          setTempPreview(null);
        }

        toast.success("头像上传成功");
        setIsDialogOpen(false);
        setSelectedFile(null);
      } else {
        toast.error(result.error || "头像上传失败");
        // 清理临时预览 URL
        if (tempPreview) {
          URL.revokeObjectURL(tempPreview);
          setTempPreview(null);
        }
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("头像上传失败，请稍后重试");
      // 清理临时预览 URL
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
        setTempPreview(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // 处理对话框关闭
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // 关闭对话框时清理临时预览
      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
        setTempPreview(null);
      }
      setSelectedFile(null);
    }
    setIsDialogOpen(open);
  };

  // 对话框中的预览 URL（优先使用临时预览，其次使用当前显示的头像）
  const dialogPreviewUrl = tempPreview || displayAvatarUrl;

  return (
    <>
      <div
        className={cn(
          "relative cursor-pointer hover:opacity-80 transition-opacity",
          className,
        )}
        onClick={() => setIsDialogOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsDialogOpen(true);
          }
        }}
        aria-label="点击修改头像"
      >
        <Avatar className="w-8 h-8">
          <AvatarImage src={displayAvatarUrl} alt={userName} />
          <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改头像</DialogTitle>
            <DialogDescription>选择一张图片上传作为头像</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-4">
            {/* 头像预览 */}
            <div className="relative">
              <Avatar className="w-28 h-28 border-4 border-gray-200 shadow-lg">
                <AvatarImage src={dialogPreviewUrl} alt="头像预览" />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* 文件输入（隐藏） */}
            <Input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />

            {/* 统一按钮区域：根据是否选择文件显示不同内容 */}
            <div className="w-full space-y-3">
              {selectedFile ? (
                <>
                  {/* 文件信息卡片 */}
                  <div className="flex items-center justify-between text-sm bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg">
                    <span className="truncate flex-1 mr-3 text-gray-700 font-medium">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  {/* 上传按钮 */}
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        上传头像
                      </>
                    )}
                  </Button>

                  {/* 重新选择和取消按钮 */}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setSelectedFile(null);
                        if (tempPreview) {
                          URL.revokeObjectURL(tempPreview);
                          setTempPreview(null);
                        }
                        // 重置文件输入
                        const input = document.getElementById(
                          "avatar-upload",
                        ) as HTMLInputElement;
                        if (input) input.value = "";
                      }}
                      disabled={isUploading}
                    >
                      重新选择
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleDialogClose(false)}
                      disabled={isUploading}
                    >
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* 选择图片按钮 */}
                  <Button
                    onClick={() =>
                      document.getElementById("avatar-upload")?.click()
                    }
                    disabled={isUploading}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    选择图片
                  </Button>

                  {/* 取消按钮 */}
                  <Button
                    variant="ghost"
                    onClick={() => handleDialogClose(false)}
                    disabled={isUploading}
                    className="w-full"
                  >
                    取消
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
