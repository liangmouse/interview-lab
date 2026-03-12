export function getCandidateName(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const rec = profile as Record<string, unknown>;
  const nickname = rec.nickname;
  if (typeof nickname === "string" && nickname.trim()) return nickname.trim();
  return null;
}
