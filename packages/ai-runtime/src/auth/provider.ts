export type OAuthCredential = {
  access: string;
  refresh?: string;
  expires?: number;
  email?: string;
};

export type LoginResult = {
  profileId: string;
  credential: OAuthCredential;
};

export interface AuthProvider {
  startLogin(input?: { remote?: boolean }): Promise<LoginResult>;
  loadCredential(profileId?: string): Promise<OAuthCredential | null>;
  saveCredential(profileId: string, credential: OAuthCredential): Promise<void>;
  refreshCredential(
    profileId: string,
    credential: OAuthCredential,
  ): Promise<OAuthCredential>;
}
