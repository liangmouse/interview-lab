"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ResumeLibraryItem {
  id: string;
  filePath: string;
  fileUrl: string;
  defaultName: string;
  uploadedAt: string;
  size?: number;
}

function buildDefaultResumeName(
  fileName: string,
  fallbackIndex: number,
): string {
  const rawName = fileName.replace(/\.pdf$/i, "").trim();
  if (!rawName) {
    return `简历-${fallbackIndex}`;
  }
  return rawName;
}

export async function getResumeLibrary(): Promise<ResumeLibraryItem[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  try {
    const { data: files, error } = await supabase.storage
      .from("resumes")
      .list(user.id, {
        limit: 100,
        sortBy: {
          column: "created_at",
          order: "desc",
        },
      });

    if (error) {
      console.error("Error fetching resume library from storage:", error);
      return [];
    }

    if (!files || files.length === 0) {
      return [];
    }

    return files
      .filter((file) => !!file.name && file.name.toLowerCase().endsWith(".pdf"))
      .map((file, index) => {
        const filePath = `${user.id}/${file.name}`;
        const {
          data: { publicUrl },
        } = supabase.storage.from("resumes").getPublicUrl(filePath);

        return {
          id: file.id ?? filePath,
          filePath,
          fileUrl: publicUrl,
          defaultName: buildDefaultResumeName(file.name, index + 1),
          uploadedAt: file.created_at || new Date().toISOString(),
          size: file.metadata?.size,
        };
      });
  } catch (error) {
    console.error("Unexpected error fetching resume library:", error);
    return [];
  }
}
