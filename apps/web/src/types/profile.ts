export interface WorkExperience {
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface ProjectExperience {
  project_name: string;
  role: string;
  start_date: string;
  end_date: string;
  tech_stack: string[];
  description: string;
}

// 更新后的UserProfile接口，匹配新的数据库结构
export interface UserProfile {
  id: string; // uuid
  user_id: string; // uuid
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  job_intention: string | null;
  company_intention: string | null;
  skills: string[] | null; // text[]
  experience_years: number | null; // integer
  graduation_date: string | null;
  work_experiences: WorkExperience[] | null; // jsonb
  project_experiences: ProjectExperience[] | null; // jsonb
  resume_url: string | null;
  created_at: string | null; // timestamp with time zone
  updated_at: string | null; // timestamp with time zone
}

export interface UserProfileFormData {
  nickname?: string;
  bio?: string;
  job_intention?: string;
  company_intention?: string;
  skills?: string;
  experience_years?: number;
  graduation_date?: string;
  work_experiences?: WorkExperience[];
  project_experiences?: ProjectExperience[];
  resume_url?: string;
}
