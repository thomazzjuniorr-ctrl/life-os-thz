import { getRuntimeConfig } from "./runtime-config.js";

const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Não foi possível carregar o script ${src}.`));
    document.head.appendChild(script);
  });
}

export function getGoogleCalendarScope() {
  return CALENDAR_SCOPE;
}

export class GoogleCalendarService {
  constructor(config = {}) {
    const runtime = getRuntimeConfig();
    this.config = {
      ...runtime.calendar,
      ...config,
    };
    this.initialized = false;
    this.tokenClient = null;
  }

  hasRequiredConfig() {
    return Boolean(this.config.clientId && this.config.apiKey);
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (!this.hasRequiredConfig()) {
      throw new Error("Preencha Client ID e API Key antes de conectar.");
    }

    await Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]);

    if (!window.gapi || !window.google) {
      throw new Error(
        "Bibliotecas do Google não carregaram. Use o app em um servidor local.",
      );
    }

    await new Promise((resolve, reject) => {
      window.gapi.load("client", async () => {
        try {
          await window.gapi.client.init({
            apiKey: this.config.apiKey,
            discoveryDocs: [DISCOVERY_DOC],
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.config.clientId,
      scope: CALENDAR_SCOPE,
      callback: () => {},
    });

    this.initialized = true;
  }

  async connect() {
    await this.initialize();

    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (response) => {
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }

        resolve({
          ok: true,
          message: "Google Calendar conectado com sucesso.",
        });
      };

      const hasToken = Boolean(window.gapi.client.getToken());
      this.tokenClient.requestAccessToken({
        prompt: hasToken ? "" : "consent",
      });
    });
  }

  async listBusyBlocks({
    calendarId = this.config.calendarId || "primary",
    timeMin,
    timeMax,
  } = {}) {
    await this.initialize();

    if (!window.gapi.client.getToken()) {
      await this.connect();
    }

    const response = await window.gapi.client.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      showDeleted: false,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    return (response.result.items || [])
      .filter((item) => item.start?.dateTime && item.end?.dateTime)
      .map((item) => ({
        id: item.id,
        title: item.summary || "Evento",
        start: item.start.dateTime,
        end: item.end.dateTime,
        source: "google",
        kind: "external",
      }));
  }
}
