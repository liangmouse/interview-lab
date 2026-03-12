import type { User } from "@/types/auth";
import type { UserProfile } from "@/types/profile";

export interface VoiceWave {
  id: number;
  height: number;
  delay: number;
}

export interface InterviewClientProps {
  user: User;
  interview: any;
  userProfile: UserProfile | null;
}
