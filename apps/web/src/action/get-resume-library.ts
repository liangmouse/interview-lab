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
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data: records, error: recordError } = await supabase
      .from("resumes")
      .select("id, storage_path, file_url, file_name, uploaded_at")
      .eq("user_id", user.id)
      .not("storage_path", "is", null)
      .order("uploaded_at", { ascending: false });
    const recordItems =
      !recordError && records
        ? records
            .filter((record) => !!record.storage_path)
            .map((record, index) => ({
              id: record.id ?? record.storage_path!,
              filePath: record.storage_path!,
              fileUrl: record.file_url || "",
              defaultName: buildDefaultResumeName(
                record.file_name || record.storage_path!.split("/").pop() || "",
                index + 1,
              ),
              uploadedAt: record.uploaded_at || new Date().toISOString(),
            }))
        : [];

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
      return recordItems;
    }

    if (!files || files.length === 0) {
      return recordItems;
    }

    const fileItems = files
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

    if (recordItems.length === 0) {
      return fileItems;
    }

    const merged = new Map(recordItems.map((item) => [item.filePath, item]));

    for (const item of fileItems) {
      if (!merged.has(item.filePath)) {
        merged.set(item.filePath, item);
      }
    }

    return Array.from(merged.values()).sort((left, right) =>
      right.uploadedAt.localeCompare(left.uploadedAt),
    );
  } catch (error) {
    console.error("Unexpected error fetching resume library:", error);
    return [];
  }
}
