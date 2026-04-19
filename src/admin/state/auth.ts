const TOKEN_KEY = "harotli_admin_token_v1";
const USER_KEY = "harotli_admin_user_v1";

// Legacy keys kept so we can migrate old logins cleanly.
const LEGACY_AUTH_KEY = "harotli_admin_auth_v1";

export type AdminUser = { id: string; email: string; fullName: string | null; role: string };

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdminUser(): AdminUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function isAdminAuthed(): boolean {
  return !!getAdminToken();
}

export function setAdminSession(token: string, user: AdminUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(LEGACY_AUTH_KEY);
}

export function clearAdminAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_AUTH_KEY);
}
