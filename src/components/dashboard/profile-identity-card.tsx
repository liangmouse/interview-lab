"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { uploadAvatar } from "@/action/upload-avatar";
import { updateUserProfile } from "@/action/user-profile";
import { useUserStore } from "@/store/user";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileIdentityCard() {
  const t = useTranslations("profile.center.identity");
  const { userInfo, setUserInfo } = useUserStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [nickname, setNickname] = useState(userInfo?.nickname || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    setNickname(userInfo?.nickname || "");
  }, [userInfo?.nickname]);

  const handleSaveNickname = useCallback(async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast.error(t("nicknameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateUserProfile({ nickname: trimmed });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.profile) {
        setUserInfo(result.profile);
      }

      toast.success(t("nicknameUpdated"));
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update nickname:", error);
      toast.error(t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [nickname, setUserInfo, t]);

  const handleCancelEdit = useCallback(() => {
    setNickname(userInfo?.nickname || "");
    setIsEditing(false);
  }, [userInfo?.nickname]);

  const handleAvatarFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error(t("invalidAvatarType"));
        event.target.value = "";
        return;
      }

      if (file.size > MAX_AVATAR_SIZE) {
        toast.error(t("avatarTooLarge"));
        event.target.value = "";
        return;
      }

      setIsUploadingAvatar(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadAvatar(formData);

        if (!result.success || !result.data?.profile) {
          toast.error(result.error || t("uploadFailed"));
          return;
        }

        setUserInfo(result.data.profile);
        toast.success(t("avatarUpdated"));
      } catch (error) {
        console.error("Failed to upload avatar:", error);
        toast.error(t("uploadFailed"));
      } finally {
        setIsUploadingAvatar(false);
        event.target.value = "";
      }
    },
    [setUserInfo, t],
  );

  return (
    <Card className="border-[#E5E5E5] bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-[#141414]">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-2 ring-[#EDEDED]">
              <AvatarImage
                src={userInfo?.avatar_url || undefined}
                alt={userInfo?.nickname || "avatar"}
              />
              <AvatarFallback className="bg-linear-to-br from-emerald-100 to-emerald-200 text-lg font-semibold text-emerald-700">
                {getInitials(userInfo?.nickname)}
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-[#E5E5E5] bg-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-[#141414]">
              {userInfo?.nickname || t("unnamed")}
            </p>
            <p className="mt-1 text-xs text-[#666666]">{t("avatarHint")}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#666666]">
            {t("nicknameLabel")}
          </label>
          <div className="relative">
            <Input
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                if (!isEditing) {
                  setIsEditing(true);
                }
              }}
              disabled={isSaving}
              className="h-9 border-[#E5E5E5] pr-16 text-sm text-[#141414]"
            />
            {isEditing && (
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveNickname}
                  className="h-7 w-7 text-emerald-700 hover:bg-emerald-50"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="h-7 w-7 text-[#666666] hover:bg-red-50 hover:text-red-600"
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
