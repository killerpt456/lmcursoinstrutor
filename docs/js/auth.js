import { AUTHORIZED_USERS } from "./auth-config.js";

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function authenticateUser(username, password) {
  const normalized = normalizeUsername(username);
  const user = AUTHORIZED_USERS.find((entry) => normalizeUsername(entry.username) === normalized);
  const passwordHash = await hashPassword(password);

  if (!user || user.passwordHash !== passwordHash) {
    return null;
  }

  return {
    username: user.username,
    name: user.name || user.username,
    role: user.role || "user",
  };
}
