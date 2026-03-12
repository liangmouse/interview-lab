export function getCandidateName(profile) {
    if (!profile || typeof profile !== "object")
        return null;
    const rec = profile;
    const nickname = rec.nickname;
    if (typeof nickname === "string" && nickname.trim())
        return nickname.trim();
    return null;
}
