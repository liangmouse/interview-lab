"use client";

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  FileText,
  Loader2,
  CheckCircle2,
  Save,
  Trash2,
  File as FileIcon,
} from "lucide-react";
import { PREDEFINED_SKILLS } from "@/lib/constants";
import { useTranslations } from "next-intl";
import { uploadResume } from "@/action/upload-resume";
import { updateUserProfile } from "@/action/user-profile";
import { useUserStore } from "@/store/user";
import { toast } from "sonner";
import type { WorkExperience } from "@/types/profile";

/** 简历上传配置 */
const RESUME_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  accept: {
    "application/pdf": [".pdf"],
  },
} as const;

export function ResumeIntelligence() {
  const t = useTranslations("profile.resume");
  const { userInfo, setUserInfo } = useUserStore();

  // 表单状态
  const [jobIntention, setJobIntention] = useState<string>("");
  const [targetCompany, setTargetCompany] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<number | undefined>(
    undefined,
  );
  const [techStack, setTechStack] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([]);

  // 上传状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "parsing" | "success" | "error"
  >("idle");

  // 技能补全状态
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);

  // 从 userInfo 初始化表单数据
  useEffect(() => {
    if (userInfo) {
      setJobIntention(userInfo.job_intention || "");
      setTargetCompany(userInfo.company_intention || "");
      setExperienceYears(userInfo.experience_years ?? undefined);
      setTechStack(userInfo.skills || []);
      setWorkExperiences(userInfo.work_experiences || []);
    }
  }, [userInfo]);

  // 处理文件验证失败
  const handleDropRejected = useCallback((rejections: FileRejection[]) => {
    const rejection = rejections[0];
    if (!rejection) return;

    const error = rejection.errors[0];
    if (error?.code === "file-too-large") {
      toast.error("文件大小不能超过 10MB");
    } else if (error?.code === "file-invalid-type") {
      toast.error("请上传 PDF 格式的简历文件");
    } else {
      toast.error("文件上传失败，请重试");
    }
  }, []);

  // 处理文件上传
  const handleDropAccepted = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) {
        console.warn("📤 [简历上传] 未检测到文件");
        return;
      }

      console.log("📤 [简历上传] 开始上传", {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        fileType: file.type,
      });

      setUploadedFile(file);
      setIsUploading(true);
      setUploadStatus("uploading");

      try {
        // 创建 FormData
        const formData = new FormData();
        formData.append("file", file);

        console.log("🤖 [简历上传] 开始 AI 解析...");
        setUploadStatus("parsing");
        const result = await uploadResume(formData);

        console.log("📊 [简历上传] 服务端返回结果:", {
          success: result.success,
          hasData: !!result.data,
          error: result.error,
        });

        if (!result.success) {
          console.error("❌ [简历上传] 上传失败:", result.error);
          toast.error(result.error || "上传失败");
          setUploadStatus("error");
          return;
        }

        // 更新 store 中的用户信息，并同步到表单
        if (result.data) {
          console.log("✅ [简历上传] 开始填充表单数据", {
            jobIntention: result.data.job_intention,
            experienceYears: result.data.experience_years,
            skillsCount: result.data.skills?.length || 0,
            workExperiencesCount: result.data.work_experiences?.length || 0,
          });

          // 更新全局 store
          setUserInfo(result.data);
          console.log("🔄 [简历上传] 全局 store 已更新");

          // 自动填充表单数据
          if (result.data.job_intention) {
            setJobIntention(result.data.job_intention);
            console.log(
              "💼 [简历上传] 目标岗位已填充:",
              result.data.job_intention,
            );
          }

          if (
            result.data.experience_years !== null &&
            result.data.experience_years !== undefined
          ) {
            setExperienceYears(result.data.experience_years);
            console.log(
              "📅 [简历上传] 工作年限已填充:",
              result.data.experience_years,
            );
          }

          if (result.data.skills) {
            setTechStack(result.data.skills);
            console.log(
              "🛠️ [简历上传] 技能栈已填充:",
              result.data.skills.join(", "),
            );
          }

          // 重点：工作经历填充
          if (result.data.work_experiences) {
            console.log("📝 [简历上传] 开始填充工作经历", {
              count: result.data.work_experiences.length,
              data: result.data.work_experiences,
            });

            setWorkExperiences(result.data.work_experiences);

            // 验证是否填充成功
            console.log(
              "✅ [简历上传] 工作经历状态已更新，当前数量:",
              result.data.work_experiences.length,
            );

            // 逐条打印工作经历详情
            result.data.work_experiences.forEach(
              (exp: WorkExperience, index: number) => {
                console.log(
                  `   ${index + 1}. ${exp.position} @ ${exp.company}`,
                  {
                    startDate: exp.start_date,
                    endDate: exp.end_date,
                    descriptionLength: exp.description?.length || 0,
                  },
                );
              },
            );
          } else {
            console.warn("⚠️ [简历上传] 未解析到工作经历数据");
          }
        } else {
          console.warn("⚠️ [简历上传] 服务端返回数据为空");
        }

        toast.success("简历解析成功，信息已自动填充");
        setUploadStatus("success");
        console.log("✨ [简历上传] 完成！");
      } catch (err) {
        console.error("❌ [简历上传] 发生异常:", err);
        console.error("异常堆栈:", err instanceof Error ? err.stack : "无堆栈");
        toast.error("上传失败，请重试");
        setUploadStatus("error");
      } finally {
        setIsUploading(false);
      }
    },
    [setUserInfo],
  );

  // 使用 react-dropzone hook
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: RESUME_CONFIG.accept,
    maxSize: RESUME_CONFIG.maxSize,
    multiple: false,
    noClick: false,
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
    disabled: isUploading,
  });

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newSkill.trim()) {
      e.preventDefault();
      // 只能添加白名单内的技能
      const match = PREDEFINED_SKILLS.find(
        (s) => s.toLowerCase() === newSkill.trim().toLowerCase(),
      );

      if (match) {
        if (!techStack.includes(match)) {
          setTechStack([...techStack, match]);
        }
        setNewSkill("");
        setShowSuggestions(false);
      } else {
        // 如果输入不完全匹配，但 suggestions 里有第一个匹配项，也可以自动选用？
        // 用户要求严格，且要支持自动补全。通常回车表示确认。
        // 我们这里允许用户通过匹配第一项来快速添加，但要基于过滤结果
        const filtered = PREDEFINED_SKILLS.filter((s) =>
          s.toLowerCase().startsWith(newSkill.trim().toLowerCase()),
        );
        if (filtered.length > 0) {
          const bestMatch = filtered[0];
          if (!techStack.includes(bestMatch)) {
            setTechStack([...techStack, bestMatch]);
          }
          setNewSkill("");
          setShowSuggestions(false);
        } else {
          toast.error("只能添加列表中的预定义技能");
        }
      }
    }
  };

  const selectSuggestion = (skill: string) => {
    if (!techStack.includes(skill)) {
      setTechStack([...techStack, skill]);
    }
    setNewSkill("");
    setShowSuggestions(false);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setTechStack(techStack.filter((skill) => skill !== skillToRemove));
  };

  // 保存表单数据
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await updateUserProfile({
        job_intention: jobIntention || undefined,
        company_intention: targetCompany || undefined,
        experience_years: experienceYears,
        skills: techStack.join(", "),
        work_experiences:
          workExperiences.length > 0 ? workExperiences : undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.profile) {
        setUserInfo(result.profile);
        toast.success("保存成功");
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast.error("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }, [
    experienceYears,
    jobIntention,
    setUserInfo,
    targetCompany,
    techStack,
    workExperiences,
  ]);

  // 添加工作经历
  const handleAddWorkExperience = () => {
    const newExp: WorkExperience = {
      company: "",
      position: "",
      start_date: "",
      end_date: "",
      description: "",
    };
    setWorkExperiences([...workExperiences, newExp]);
  };

  // 删除工作经历
  const handleRemoveWorkExperience = (index: number) => {
    setWorkExperiences(workExperiences.filter((_, i) => i !== index));
  };

  // 更新工作经历
  const handleUpdateWorkExperience = (
    index: number,
    field: keyof WorkExperience,
    value: string,
  ) => {
    const updated = [...workExperiences];
    updated[index] = { ...updated[index], [field]: value };
    setWorkExperiences(updated);
  };

  // 渲染上传区域内容
  const renderDropzoneContent = () => {
    if (isUploading) {
      return (
        <>
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-emerald-600" />
          <h3 className="mb-2 text-lg font-medium text-[#141414]">
            {uploadStatus === "parsing" ? "AI 正在解析简历..." : "正在上传..."}
          </h3>
          <p className="text-sm text-[#666666]">{uploadedFile?.name}</p>
        </>
      );
    }

    if (uploadStatus === "success" && uploadedFile) {
      return (
        <>
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
          <h3 className="mb-2 text-lg font-medium text-[#141414]">解析完成</h3>
          <div
            className={`mb-4 flex items-center justify-center gap-2 text-sm text-[#666666] ${
              userInfo?.resume_url
                ? "cursor-pointer transition-colors hover:text-[#0F3E2E]"
                : ""
            }`}
            onClick={(e) => {
              if (userInfo?.resume_url) {
                e.stopPropagation();
                window.open(userInfo.resume_url, "_blank");
              }
            }}
          >
            <FileText className="h-4 w-4" />
            <span
              className={
                userInfo?.resume_url ? "underline underline-offset-4" : ""
              }
            >
              {uploadedFile.name}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setUploadStatus("idle");
              setUploadedFile(null);
            }}
            className="border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]"
          >
            重新上传
          </Button>
        </>
      );
    }

    return (
      <>
        <FileIcon
          className={`mx-auto mb-4 h-12 w-12 transition-colors ${
            isDragActive ? "text-emerald-700" : "text-emerald-600"
          }`}
        />
        <h3 className="mb-2 text-lg font-medium text-[#141414]">
          {isDragActive ? "松开以上传文件" : t("autoParseTitle")}
        </h3>
        <p className="mb-4 text-sm text-[#666666]">
          {isDragActive ? "支持 PDF 格式" : t("autoParseDesc")}
        </p>
        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          className="border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]"
        >
          {t("chooseFile")}
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* 拖拽上传区域 */}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
          isDragActive
            ? "border-emerald-500 bg-emerald-100/50"
            : isUploading
              ? "border-emerald-400/50 bg-emerald-50/30"
              : uploadStatus === "success"
                ? "border-emerald-500/50 bg-emerald-50/50"
                : "border-emerald-500/30 bg-emerald-50/50 hover:border-emerald-500/50 hover:bg-emerald-50/70"
        }`}
      >
        <input {...getInputProps()} />
        {renderDropzoneContent()}
      </div>

      {/* Professional Details Form */}
      <div className="space-y-6 rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#141414]">
            {t("professionalDetails")}
          </h2>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-[#0F3E2E] text-white hover:bg-[#0F3E2E]/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="target-role" className="text-[#141414]">
              {t("targetRole")}
            </Label>
            <Select value={jobIntention} onValueChange={setJobIntention}>
              <SelectTrigger
                id="target-role"
                className="w-full border-[#E5E5E5] bg-white"
              >
                <SelectValue placeholder={t("targetRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frontend">{t("roles.frontend")}</SelectItem>
                <SelectItem value="backend">{t("roles.backend")}</SelectItem>
                <SelectItem value="fullstack">
                  {t("roles.fullstack")}
                </SelectItem>
                <SelectItem value="devops">{t("roles.devops")}</SelectItem>
                <SelectItem value="mobile">{t("roles.mobile")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-company" className="text-[#141414]">
              {t("targetCompany")}
            </Label>
            <Input
              id="target-company"
              placeholder={t("targetCompanyPlaceholder")}
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              className="border-[#E5E5E5] bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience" className="text-[#141414]">
              {t("yearsOfExperience")}
            </Label>
            <Input
              id="experience"
              type="number"
              placeholder="0"
              value={experienceYears ?? ""}
              onChange={(e) =>
                setExperienceYears(
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              className="border-[#E5E5E5] bg-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tech-stack" className="text-[#141414]">
            {t("techStack")}
          </Label>
          <div className="mb-3 flex flex-wrap gap-2">
            {techStack.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-[#141414]"
              >
                {skill}
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-[#0F3E2E]"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="relative">
            <Input
              id="tech-stack"
              placeholder={t("typeSkillHint")}
              value={newSkill}
              onChange={(e) => {
                setNewSkill(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // 延迟关闭，以便点击事件能触发
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              onKeyDown={handleAddSkill}
              className="border-[#E5E5E5] bg-white"
              autoComplete="off"
            />
            {/* 自动补全下拉列表 */}
            {showSuggestions && newSkill && (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {PREDEFINED_SKILLS.filter(
                  (skill) =>
                    skill.toLowerCase().includes(newSkill.toLowerCase()) &&
                    !techStack.includes(skill),
                ).length > 0 ? (
                  <ul className="py-1">
                    {PREDEFINED_SKILLS.filter(
                      (skill) =>
                        skill.toLowerCase().includes(newSkill.toLowerCase()) &&
                        !techStack.includes(skill),
                    ).map((skill) => (
                      <li
                        key={skill}
                        className="cursor-pointer px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                        onMouseDown={(e) => {
                          e.preventDefault(); // 防止 input blur
                          selectSuggestion(skill);
                        }}
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-2 text-sm text-slate-400">
                    无匹配技能
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-[#666666]">{t("pressEnterHint")}</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[#141414]">{t("workExperience")}</Label>
            <Button
              variant="ghost"
              onClick={handleAddWorkExperience}
              className="gap-2 text-[#0F3E2E] hover:bg-[#0F3E2E]/5 hover:text-[#0F3E2E]"
            >
              <Plus className="h-4 w-4" />
              {t("addExperience")}
            </Button>
          </div>

          {/* Timeline Container */}
          {workExperiences.length > 0 ? (
            <div className="relative space-y-6 pl-6">
              {/* Vertical Timeline Line */}
              <div className="absolute left-0 top-2 bottom-2 w-px bg-[#E5E5E5]" />

              {workExperiences.map((exp, index) => (
                <div key={index} className="relative">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-6 top-2 h-3 w-3 rounded-full border-2 ${
                      index === 0
                        ? "border-[#0F3E2E] bg-white"
                        : "border-[#E5E5E5] bg-white"
                    }`}
                  />

                  <div className="space-y-3 rounded-lg border border-[#E5E5E5] bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="职位名称"
                          value={exp.position}
                          onChange={(e) =>
                            handleUpdateWorkExperience(
                              index,
                              "position",
                              e.target.value,
                            )
                          }
                          className="border-[#E5E5E5] bg-white font-bold"
                        />
                        <Input
                          placeholder="公司名称"
                          value={exp.company}
                          onChange={(e) =>
                            handleUpdateWorkExperience(
                              index,
                              "company",
                              e.target.value,
                            )
                          }
                          className="border-[#E5E5E5] bg-white text-sm"
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="开始日期 (YYYY-MM)"
                            value={exp.start_date}
                            onChange={(e) =>
                              handleUpdateWorkExperience(
                                index,
                                "start_date",
                                e.target.value,
                              )
                            }
                            className="border-[#E5E5E5] bg-white text-xs"
                          />
                          <Input
                            placeholder="结束日期 (YYYY-MM) 或 至今"
                            value={exp.end_date}
                            onChange={(e) =>
                              handleUpdateWorkExperience(
                                index,
                                "end_date",
                                e.target.value,
                              )
                            }
                            className="border-[#E5E5E5] bg-white text-xs"
                          />
                        </div>
                        <textarea
                          placeholder="工作描述（每行一条，用 • 开头）"
                          value={exp.description}
                          onChange={(e) =>
                            handleUpdateWorkExperience(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          rows={4}
                          className="w-full resize-none rounded-md border border-[#E5E5E5] bg-white p-2 text-sm text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#0F3E2E]/20"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveWorkExperience(index)}
                        className="ml-2 h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#E5E5E5] bg-[#F5F5F5] p-8 text-center">
              <p className="text-sm text-[#666666]">
                暂无工作经历，点击上方按钮添加
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
