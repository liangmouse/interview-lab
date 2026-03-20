export interface ResumeReviewSuggestion {
  original: string;
  improved: string;
  reason: string;
}

export interface ResumeReviewSection {
  sectionName: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: ResumeReviewSuggestion[];
}

export interface ATSCompatibility {
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface JDMatchAnalysis {
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  recommendations: string[];
}

export interface ResumeReviewResult {
  id: string;
  overallScore: number;
  overallAssessment: string;
  sections: ResumeReviewSection[];
  atsCompatibility: ATSCompatibility;
  jdMatchAnalysis?: JDMatchAnalysis;
  createdAt: string;
  resumeName: string;
}
