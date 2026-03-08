export interface JobDescriptionRequirement {
  item: string;
}

export interface JobDescription {
  id: string;
  user_id: string;
  title: string | null;
  source_type: "manual" | "upload";
  source_file_url: string | null;
  raw_text: string;
  summary: string | null;
  experience_level: string | null;
  keywords: string[];
  requirements: JobDescriptionRequirement[];
  responsibilities: JobDescriptionRequirement[];
  created_at: string;
  updated_at: string;
}

export interface JobDescriptionAnalysis {
  title?: string | null;
  summary?: string | null;
  experienceLevel?: string | null;
  keywords?: string[];
  requirements?: JobDescriptionRequirement[];
  responsibilities?: JobDescriptionRequirement[];
}
