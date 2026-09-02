export const SESSION_COOKIE = "pdef_session";
export const SHARE_COOKIE = "pdef_share";

export type UserStatus = "pending" | "active" | "rejected";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthUser extends SessionUser {
  status: UserStatus;
  isAdmin: boolean;
  isManagement: boolean;
  collaboratorId: string | null;
}
