const defaultRuntimeConfig = {
  deployment: {
    platform: "netlify",
    stage: "production",
    publicBaseUrl: "",
  },
  access: {
    protectionMode: "platform-password",
    sessionMode: "none",
  },
  auth: {
    enabled: false,
    provider: "google",
    googleClientId: "",
    googleHostedDomain: "",
    allowedEmails: [],
  },
  calendar: {
    clientId: "",
    apiKey: "",
    calendarId: "primary",
  },
  pwa: {
    enabled: false,
    serviceWorkerPath: "/sw.js",
  },
};

function mergeSection(base, incoming) {
  return {
    ...base,
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  };
}

export function getRuntimeConfig() {
  const globalConfig =
    typeof window !== "undefined" && window.__LIFE_OS_RUNTIME__
      ? window.__LIFE_OS_RUNTIME__
      : {};

  return {
    deployment: mergeSection(defaultRuntimeConfig.deployment, globalConfig.deployment),
    access: mergeSection(defaultRuntimeConfig.access, globalConfig.access),
    auth: mergeSection(defaultRuntimeConfig.auth, globalConfig.auth),
    calendar: mergeSection(defaultRuntimeConfig.calendar, globalConfig.calendar),
    pwa: mergeSection(defaultRuntimeConfig.pwa, globalConfig.pwa),
  };
}

export function getPublicBaseUrl() {
  const { deployment } = getRuntimeConfig();
  return deployment.publicBaseUrl || "";
}
