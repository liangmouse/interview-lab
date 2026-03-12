"use server";

import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

export async function uploadAvatar(formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "用户未认证" };
    }

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "未提供文件" };
    }

    // 验证文件类型
    const validImageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!validImageTypes.includes(file.type)) {
      return {
        success: false,
        error: "不支持的图片格式，请上传 JPEG、PNG、WebP 或 GIF 格式的图片",
      };
    }

    // 验证文件大小（限制为 5MB）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { success: false, error: "图片大小不能超过 5MB" };
    }

    // 1. 上传文件到 Supabase Storage（使用 avatars bucket）
    const fileExtension = file.name.split(".").pop() || "jpg";
    // 路径格式: {user_id}/{uuid}.{ext}，与 RLS 策略匹配
    const fileName = `${user.id}/${uuidv4()}.${fileExtension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucketName = "avatars";

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return {
        success: false,
        error: `上传失败: ${uploadError.message}`,
      };
    }

    // 2. 获取公共 URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    if (!publicUrlData) {
      return { success: false, error: "无法获取头像公共 URL" };
    }

    const publicUrl = publicUrlData.publicUrl;

    // 3. 更新或创建用户资料中的 avatar_url
    // 先检查用户资料是否存在
    const { data: existingProfile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const isFirstCreate = fetchError?.code === "PGRST116" || !existingProfile;

    // 使用 upsert 来更新或创建用户资料
    const profileData: any = {
      user_id: user.id,
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    };

    if (isFirstCreate) {
      profileData.created_at = new Date().toISOString();
    }

    const { data, error: updateError } = await supabase
      .from("user_profiles")
      .upsert(profileData, { onConflict: "user_id" })
      .select()
      .single();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return {
        success: false,
        error: `更新用户资料失败: ${updateError.message}`,
      };
    }

    return { success: true, data: { avatar_url: publicUrl, profile: data } };
  } catch (e) {
    const error = e as Error;
    console.error("Upload avatar error:", error);
    return { success: false, error: error.message };
  }
}
