"use server";
// https://js.langchain.com/docs/integrations/document_loaders/file_loaders/pdf/
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

/**
 * 从上传的PDF Buffer解析成纯文本
 * @param formData
 * @returns
 */
export async function parsePdf(formData: FormData) {
  try {
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    const loader = new PDFLoader(file);
    const docs = await loader.load();
    const fullText = docs.map((doc) => doc.pageContent).join("\n");

    return {
      success: true,
      text: fullText,
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);

    return {
      success: false,
      error: "Failed to parse PDF",
    };
  }
}
