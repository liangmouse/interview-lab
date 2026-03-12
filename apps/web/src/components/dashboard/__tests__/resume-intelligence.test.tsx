import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ResumeIntelligence } from "../resume-intelligence";
import { useUserStore } from "@/store/user";
import * as uploadResumeAction from "@/action/upload-resume";
import { NextIntlClientProvider } from "next-intl";

// Mock Zustand store
vi.mock("@/store/user", () => ({
  useUserStore: vi.fn(),
}));

// Mock upload-resume action
vi.mock("@/action/upload-resume", () => ({
  uploadResume: vi.fn(),
}));

// Mock next-intl
const messages = {
  profile: {
    resume: {
      autoParseTitle: "拖拽上传简历",
      autoParseDesc: "支持 PDF 格式，最大 10MB",
      chooseFile: "选择文件",
      professionalDetails: "专业信息",
      targetRole: "目标岗位",
      yearsOfExperience: "工作年限",
      techStack: "技术栈",
      typeSkillHint: "输入技能名称",
      pressEnterHint: "按回车添加",
      workExperience: "工作经历",
      addExperience: "添加经历",
      roles: {
        frontend: "前端开发",
        backend: "后端开发",
        fullstack: "全栈开发",
        devops: "DevOps",
        mobile: "移动开发",
      },
    },
  },
};

describe("ResumeIntelligence 组件", () => {
  const mockSetUserInfo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // 设置默认的 store mock
    (useUserStore as any).mockReturnValue({
      userInfo: null,
      setUserInfo: mockSetUserInfo,
    });
  });

  const renderComponent = () => {
    return render(
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <ResumeIntelligence />
      </NextIntlClientProvider>,
    );
  };

  describe("初始化和数据渲染", () => {
    it("应该正确渲染组件", () => {
      renderComponent();

      expect(screen.getByText("拖拽上传简历")).toBeInTheDocument();
      expect(screen.getByText("专业信息")).toBeInTheDocument();
    });

    it("应该从 userInfo 加载已有数据", () => {
      const mockUserInfo = {
        job_intention: "frontend",
        experience_years: 3,
        skills: ["React", "TypeScript"],
        work_experiences: [
          {
            company: "测试公司",
            position: "前端开发",
            start_date: "2020-01",
            end_date: "2023-01",
            description: "负责前端开发",
          },
        ],
      };

      (useUserStore as any).mockReturnValue({
        userInfo: mockUserInfo,
        setUserInfo: mockSetUserInfo,
      });

      renderComponent();

      expect(screen.getByDisplayValue("测试公司")).toBeInTheDocument();
      expect(screen.getByDisplayValue("前端开发")).toBeInTheDocument();
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
    });
  });

  describe("简历上传和解析", () => {
    it("应该在上传成功后自动填充工作经历", async () => {
      const mockResumeData = {
        success: true,
        data: {
          job_intention: "backend",
          experience_years: 5,
          skills: ["Node.js", "Python", "PostgreSQL"],
          work_experiences: [
            {
              company: "科技公司A",
              position: "高级后端工程师",
              start_date: "2019-03",
              end_date: "2024-12",
              description: "• 负责后端架构设计\n• 优化数据库性能",
            },
            {
              company: "创业公司B",
              position: "后端开发",
              start_date: "2017-06",
              end_date: "2019-02",
              description: "• 开发 RESTful API\n• 实现微服务架构",
            },
          ],
        },
      };

      vi.mocked(uploadResumeAction.uploadResume).mockResolvedValue(
        mockResumeData,
      );

      renderComponent();

      // 模拟文件拖拽
      const file = new File(["测试简历内容"], "resume.pdf", {
        type: "application/pdf",
      });

      const dropzone = screen.getByText("拖拽上传简历").closest("div");

      // 触发 onDrop 事件
      const event = new Event("drop", { bubbles: true });
      Object.defineProperty(event, "dataTransfer", {
        value: {
          files: [file],
        },
      });

      dropzone?.dispatchEvent(event);

      // 等待上传完成
      await waitFor(
        () => {
          expect(uploadResumeAction.uploadResume).toHaveBeenCalledWith(
            expect.any(FormData),
          );
        },
        { timeout: 3000 },
      );

      // 验证工作经历是否正确填充
      await waitFor(() => {
        expect(screen.getByDisplayValue("科技公司A")).toBeInTheDocument();
        expect(screen.getByDisplayValue("高级后端工程师")).toBeInTheDocument();
        expect(screen.getByDisplayValue("创业公司B")).toBeInTheDocument();
        expect(screen.getByDisplayValue("后端开发")).toBeInTheDocument();
      });

      // 验证技能是否正确填充
      expect(screen.getByText("Node.js")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL")).toBeInTheDocument();

      // 验证 store 是否更新
      expect(mockSetUserInfo).toHaveBeenCalledWith(mockResumeData.data);
    });

    it("应该处理工作经历为空的情况", async () => {
      const mockResumeData = {
        success: true,
        data: {
          job_intention: "frontend",
          experience_years: 1,
          skills: ["HTML", "CSS", "JavaScript"],
          work_experiences: [], // 空数组
        },
      };

      vi.mocked(uploadResumeAction.uploadResume).mockResolvedValue(
        mockResumeData,
      );

      renderComponent();

      const file = new File(["应届生简历"], "resume.pdf", {
        type: "application/pdf",
      });

      const dropzone = screen.getByText("拖拽上传简历").closest("div");
      const event = new Event("drop", { bubbles: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { files: [file] },
      });

      dropzone?.dispatchEvent(event);

      await waitFor(() => {
        expect(uploadResumeAction.uploadResume).toHaveBeenCalled();
      });

      // 应该显示空状态提示
      await waitFor(() => {
        expect(
          screen.getByText("暂无工作经历，点击上方按钮添加"),
        ).toBeInTheDocument();
      });
    });

    it("应该处理上传失败的情况", async () => {
      vi.mocked(uploadResumeAction.uploadResume).mockResolvedValue({
        success: false,
        error: "文件解析失败",
      });

      renderComponent();

      const file = new File(["损坏的PDF"], "resume.pdf", {
        type: "application/pdf",
      });

      const dropzone = screen.getByText("拖拽上传简历").closest("div");
      const event = new Event("drop", { bubbles: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { files: [file] },
      });

      dropzone?.dispatchEvent(event);

      await waitFor(() => {
        expect(uploadResumeAction.uploadResume).toHaveBeenCalled();
      });

      // 验证没有自动填充数据
      expect(mockSetUserInfo).not.toHaveBeenCalled();
    });
  });

  describe("边界情况测试", () => {
    it("应该正确处理部分字段缺失的简历", async () => {
      const mockResumeData = {
        success: true,
        data: {
          // job_intention 缺失
          experience_years: 2,
          skills: ["Vue.js"],
          work_experiences: [
            {
              company: "公司C",
              position: "前端",
              start_date: "2022-01",
              end_date: "至今",
              description: "开发工作",
            },
          ],
        },
      };

      vi.mocked(uploadResumeAction.uploadResume).mockResolvedValue(
        mockResumeData,
      );

      renderComponent();

      const file = new File(["不完整简历"], "resume.pdf", {
        type: "application/pdf",
      });

      const dropzone = screen.getByText("拖拽上传简历").closest("div");
      const event = new Event("drop", { bubbles: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { files: [file] },
      });

      dropzone?.dispatchEvent(event);

      await waitFor(() => {
        expect(uploadResumeAction.uploadResume).toHaveBeenCalled();
      });

      // 验证有值的字段被正确填充
      await waitFor(() => {
        expect(screen.getByDisplayValue("公司C")).toBeInTheDocument();
        expect(screen.getByText("Vue.js")).toBeInTheDocument();
      });
    });
  });
});
