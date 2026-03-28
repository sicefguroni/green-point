export const PROFILE_AVATARS_BUCKET = "profile-avatars";
export const IDENTITY_DOCUMENTS_BUCKET = "identity-documents";

export function avatarObjectPath(userId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${Date.now()}-${safe}`;
}

export function identityDocObjectPath(userId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${Date.now()}-${safe}`;
}
