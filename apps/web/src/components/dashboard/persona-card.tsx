"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ImageCropper } from "@/components/custom/image-cropper";
import {
  Camera,
  Bell,
  Palette,
  Settings,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useUserStore } from "@/store/user";
import { updateUserProfile } from "@/action/user-profile";
import { uploadAvatar } from "@/action/upload-avatar";
import { toast } from "sonner";

/** 头像上传配置 */
const AVATAR_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  accept: {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
  },
} as const;

/** 获取用户名首字母作为头像 fallback */
function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PersonaCard() {
  const t = useTranslations("profile.persona");
  const { userInfo, setUserInfo, _hasHydrated } = useUserStore();

  const [nickname, setNickname] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // 裁剪对话框状态
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 同步 store 中的昵称
  useEffect(() => {
    if (userInfo?.nickname) {
      setNickname(userInfo.nickname);
    }
  }, [userInfo?.nickname]);

  // 处理文件验证失败
  const handleDropRejected = useCallback((rejections: FileRejection[]) => {
    const rejection = rejections[0];
    if (!rejection) return;

    const error = rejection.errors[0];
    if (error?.code === "file-too-large") {
      toast.error("图片大小不能超过 5MB");
    } else if (error?.code === "file-invalid-type") {
      toast.error("请上传 JPEG、PNG、WebP 或 GIF 格式的图片");
    } else {
      toast.error("文件上传失败，请重试");
    }
  }, []);

  // 处理文件选择成功
  const handleDropAccepted = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setCropperOpen(true);
  }, []);

  // 使用 react-dropzone hook（内置文件类型和大小验证）
  const { getRootProps, getInputProps, open } = useDropzone({
    accept: AVATAR_CONFIG.accept,
    maxSize: AVATAR_CONFIG.maxSize,
    multiple: false,
    noClick: true, // 禁用默认点击，由按钮触发
    noKeyboard: true,
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
  });

  // 关闭裁剪对话框
  const handleCropperClose = useCallback(() => {
    setCropperOpen(false);
    // 释放图片 URL
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
      setSelectedImage(null);
    }
  }, [selectedImage]);

  // 裁剪完成后上传
  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      setIsUploadingAvatar(true);

      try {
        // 将 Blob 转换为 File
        const file = new File([croppedBlob], "avatar.jpg", {
          type: "image/jpeg",
        });

        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadAvatar(formData);

        if (!result.success) {
          toast.error(result.error || "上传失败");
          return;
        }

        // 更新 store 中的头像
        if (result.data?.profile) {
          setUserInfo(result.data.profile);
          toast.success("头像已更新");
        }
      } catch (err) {
        console.error("Failed to upload avatar:", err);
        toast.error("上传失败，请重试");
      } finally {
        setIsUploadingAvatar(false);
        handleCropperClose();
      }
    },
    [setUserInfo, handleCropperClose],
  );

  // 保存昵称
  const handleSaveNickname = useCallback(async () => {
    if (!nickname.trim()) {
      toast.error("昵称不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateUserProfile({ nickname: nickname.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.profile) {
        setUserInfo(result.profile);
        toast.success("昵称已更新");
      }
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update nickname:", err);
      toast.error("更新失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }, [nickname, setUserInfo]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setNickname(userInfo?.nickname || "");
    setIsEditing(false);
  }, [userInfo?.nickname]);

  // 计算用户等级（基于面试次数，后续可以改为更复杂的算法）
  const userLevel = userInfo?.experience_years
    ? Math.min(Math.floor(userInfo.experience_years / 2) + 1, 10)
    : 1;

  // Hydration 未完成时显示骨架屏，避免头像闪烁
  if (!_hasHydrated) {
    return (
      <div className="sticky top-6 h-fit rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
        {/* 头像骨架 */}
        <div className="relative mb-6 flex justify-center">
          <Skeleton className="h-32 w-32 rounded-full bg-gray-200" />
        </div>
        {/* 昵称骨架 */}
        <div className="mb-4">
          <Skeleton className="mx-auto mb-2 h-3 w-12 bg-gray-200" />
          <Skeleton className="h-10 w-full bg-gray-200" />
        </div>
        {/* 等级骨架 */}
        <div className="mb-6 flex justify-center">
          <Skeleton className="h-7 w-24 rounded-full bg-gray-200" />
        </div>
        {/* 设置项骨架 */}
        <div className="space-y-1 border-t border-[#E5E5E5] pt-4">
          <Skeleton className="h-10 w-full bg-gray-200" />
          <Skeleton className="h-10 w-full bg-gray-200" />
          <Skeleton className="h-10 w-full bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-6 h-fit rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
      {/* Avatar Section */}
      <div className="relative mb-6 flex justify-center">
        <div {...getRootProps()} className="relative">
          {/* 隐藏的文件输入（由 react-dropzone 管理） */}
          <input {...getInputProps()} />

          {/* 头像 */}
          <Avatar className="h-32 w-32 ring-4 ring-[#F5F5F5]">
            <AvatarImage
              src={userInfo?.avatar_url || undefined}
              alt={userInfo?.nickname || "用户头像"}
            />
            <AvatarFallback className="bg-linear-to-br from-emerald-100 to-emerald-200 text-2xl font-semibold text-emerald-700">
              {getInitials(userInfo?.nickname)}
            </AvatarFallback>
          </Avatar>

          {/* 上传中遮罩 */}
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {/* 编辑按钮 - 使用 dropzone 的 open 方法触发文件选择 */}
          <Button
            size="icon"
            variant="outline"
            onClick={open}
            disabled={isUploadingAvatar}
            className="absolute bottom-0 right-0 h-10 w-10 rounded-full border-2 border-white bg-white shadow-md hover:bg-[#F5F5F5] cursor-pointer disabled:opacity-50"
          >
            <Camera className="h-4 w-4 text-[#141414]" />
          </Button>
        </div>
      </div>

      {/* Nickname Field */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium text-[#666666]">
          {t("nickname")}
        </label>
        <div className="relative">
          <Input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              if (!isEditing) setIsEditing(true);
            }}
            placeholder="设置昵称"
            disabled={isSaving}
            className="border-[#E5E5E5] bg-white pr-20 text-center text-lg font-bold text-[#141414]"
          />
          {isEditing && (
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveNickname}
                disabled={isSaving}
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="h-7 w-7 text-[#666666] hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Level Badge */}
      <div className="mb-6 flex justify-center">
        <Badge
          variant="secondary"
          className="bg-linear-to-r from-emerald-50 to-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700"
        >
          {t("level", { level: userLevel, title: t("levelTitle") })}
        </Badge>
      </div>

      {/* User Info */}
      {userInfo?.job_intention && (
        <div className="mb-4 text-center">
          <p className="text-sm text-[#666666]">{userInfo.job_intention}</p>
        </div>
      )}

      {/* Settings List */}
      <div className="space-y-1 border-t border-[#E5E5E5] pt-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[#666666] hover:bg-[#F5F5F5] hover:text-[#141414]"
        >
          <Settings className="h-4 w-4" />
          {t("account")}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[#666666] hover:bg-[#F5F5F5] hover:text-[#141414]"
        >
          <Bell className="h-4 w-4" />
          {t("notifications")}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[#666666] hover:bg-[#F5F5F5] hover:text-[#141414]"
        >
          <Palette className="h-4 w-4" />
          {t("theme")}
        </Button>
      </div>

      {/* 头像裁剪对话框 */}
      {selectedImage && (
        <ImageCropper
          open={cropperOpen}
          onClose={handleCropperClose}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          cropShape="round"
          aspect={1}
          title="裁剪头像"
        />
      )}
    </div>
  );
}
