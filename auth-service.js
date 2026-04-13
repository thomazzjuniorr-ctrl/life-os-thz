import { getRuntimeConfig } from "./runtime-config.js";

const AUTH_SESSION_KEY = "life-os-thz-2026-auth-session";

export function getAuthBlueprint() {
  const runtime = getRuntimeConfig();
  return {
    enabled: Boolean(runtime.auth.enabled),
    provider: runtime.auth.provider || "google",
    googleClientId: runtime.auth.googleClientId || "",
    googleHostedDomain: runtime.auth.googleHostedDomain || "",
    allowedEmails: Array.isArray(runtime.auth.allowedEmails)
      ? runtime.auth.allowedEmails
      : [],
  };
}

export class AuthService {
  constructor(config = getAuthBlueprint()) {
    this.config = config;
  }

  isConfigured() {
    return Boolean(this.config.enabled && this.config.provider === "google" && this.config.googleClientId);
  }

  getSession() {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveSession(session) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }

  clearSession() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  }

  async beginGoogleSignIn() {
    if (!this.isConfigured()) {
      throw new Error("Google Auth ainda nao foi configurado para este deploy.");
    }

    throw new Error("Fluxo Google Auth reservado para a proxima etapa da arquitetura.");
  }
}
