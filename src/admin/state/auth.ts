const AUTH_KEY = "harotli_admin_auth_v1";

export const TEST_ADMIN_USERNAME = "admin";
export const TEST_ADMIN_PASSWORD = "1020304050";

export function isAdminAuthed() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function setAdminAuthed() {
  localStorage.setItem(AUTH_KEY, "1");
}

export function clearAdminAuth() {
  localStorage.removeItem(AUTH_KEY);
}

