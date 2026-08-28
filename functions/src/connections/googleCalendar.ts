import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateBearer } from "../chat/auth";
import { firestore } from "../chat/firebase";
import { setCorsHeaders } from "../http/cors";
import { verifyAppCheckHeader } from "../http/appCheck";

const GOOGLE_OAUTH_CLIENT_IDS = defineString("GOOGLE_OAUTH_CLIENT_IDS", { default: "" });
const GOOGLE_OAUTH_WEB_CLIENT_ID = defineString("GOOGLE_OAUTH_WEB_CLIENT_ID", { default: "" });
const GOOGLE_OAUTH_WEB_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_WEB_CLIENT_SECRET");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type ConnectionDocument = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  clientId: string;
  scope: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

const connectionRef = (uid: string) =>
  firestore.collection("users").doc(uid).collection("connections").doc("google_calendar");

const allowedClientIds = (): Set<string> =>
  new Set(GOOGLE_OAUTH_CLIENT_IDS.value().split(",").map((item) => item.trim()).filter(Boolean));

const authenticate = async (request: { headers: Record<string, unknown> }) => {
  const authorization = typeof request.headers.authorization === "string"
    ? request.headers.authorization
    : undefined;
  return authenticateBearer(authorization);
};

const validateRequest = async (
  request: Parameters<typeof setCorsHeaders>[0],
  response: Parameters<typeof setCorsHeaders>[1],
  method: "GET" | "POST",
  operation: string,
): Promise<string | null> => {
  if (!setCorsHeaders(request, response)) {
    response.status(403).json({ error: "Origin not allowed" });
    return null;
  }
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return null;
  }
  if (request.method !== method) {
    response.status(405).json({ error: "Method not allowed" });
    return null;
  }
  const appCheckOk = await verifyAppCheckHeader(
    typeof request.headers["x-firebase-appcheck"] === "string"
      ? request.headers["x-firebase-appcheck"]
      : undefined,
    operation,
  );
  if (!appCheckOk) {
    response.status(401).json({ error: "Invalid App Check token" });
    return null;
  }
  const authentication = await authenticate(request);
  if (!authentication.ok) {
    response.status(401).json({ error: "Invalid authentication" });
    return null;
  }
  return authentication.uid;
};

const parseBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? body as Record<string, unknown> : {};
};

const exchangeToken = async (params: URLSearchParams): Promise<TokenResponse> => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = await response.json().catch(() => ({})) as TokenResponse;
  if (!response.ok || !body.access_token) throw new Error(body.error || "oauth_exchange_failed");
  return body;
};

const refreshAccessToken = async (document: ConnectionDocument): Promise<ConnectionDocument> => {
  if (!document.refreshToken) throw new Error("reconnect_required");
  const params = new URLSearchParams({
    client_id: document.clientId,
    refresh_token: document.refreshToken,
    grant_type: "refresh_token",
  });
  if (document.clientId === GOOGLE_OAUTH_WEB_CLIENT_ID.value()) {
    params.set("client_secret", GOOGLE_OAUTH_WEB_CLIENT_SECRET.value());
  }
  const token = await exchangeToken(params);
  return {
    ...document,
    accessToken: token.access_token ?? "",
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    scope: token.scope ?? document.scope,
  };
};

const getActiveConnection = async (uid: string): Promise<ConnectionDocument> => {
  const ref = connectionRef(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("not_connected");
  let connection = snapshot.data() as ConnectionDocument;
  if (connection.expiresAt <= Date.now() + 60_000) {
    connection = await refreshAccessToken(connection);
    await ref.set({ ...connection, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return connection;
};

const normalizeEvent = (event: GoogleEvent) => {
  if (!event.id || event.status === "cancelled" || !event.start) return null;
  const allDay = Boolean(event.start.date && !event.start.dateTime);
  const startAt = event.start.dateTime ?? `${event.start.date}T00:00:00`;
  const endAt = event.end?.dateTime ?? `${event.end?.date ?? event.start.date}T00:00:00`;
  const date = event.start.date ?? startAt.slice(0, 10);
  const time = allDay ? undefined : startAt.slice(11, 16);
  return {
    id: event.id,
    calendarId: "primary",
    title: event.summary?.trim() || "",
    date,
    time,
    startAt,
    endAt,
    allDay,
    timeZone: event.start.timeZone,
    location: event.location?.trim() || undefined,
    type: "event",
    source: "google",
  };
};

const fetchEvents = async (accessToken: string) => {
  const now = new Date();
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 31);
  const events: Array<ReturnType<typeof normalizeEvent>> = [];
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "250",
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${CALENDAR_API}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(response.status === 401 ? "reconnect_required" : "calendar_fetch_failed");
    const body = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string };
    for (const item of body.items ?? []) events.push(normalizeEvent(item));
    pageToken = body.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return events.filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
};

const functionOptions = {
  secrets: [GOOGLE_OAUTH_WEB_CLIENT_SECRET],
  cors: false,
  timeoutSeconds: 30,
  memory: "256MiB" as const,
};

export const disconnectGoogleCalendarForUser = async (uid: string): Promise<void> => {
  const ref = connectionRef(uid);
  const snapshot = await ref.get();
  const connection = snapshot.data() as ConnectionDocument | undefined;
  if (connection) {
    const token = connection.refreshToken ?? connection.accessToken;
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    }).catch(() => undefined);
  }
  await ref.delete();
};

export const googleCalendarConnect = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, "POST", "googleCalendarConnect");
  if (!uid) return;
  const body = parseBody(request.body);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const codeVerifier = typeof body.codeVerifier === "string" ? body.codeVerifier.trim() : "";
  const redirectUri = typeof body.redirectUri === "string" ? body.redirectUri.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!code || !codeVerifier || !redirectUri || !allowedClientIds().has(clientId)) {
    response.status(400).json({ error: "Invalid OAuth request" });
    return;
  }
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    if (clientId === GOOGLE_OAUTH_WEB_CLIENT_ID.value()) {
      params.set("client_secret", GOOGLE_OAUTH_WEB_CLIENT_SECRET.value());
    }
    const token = await exchangeToken(params);
    if (!(token.scope ?? "").split(" ").includes(CALENDAR_SCOPE)) {
      response.status(403).json({ error: "Calendar permission missing" });
      return;
    }
    const ref = connectionRef(uid);
    const previous = await ref.get();
    const previousRefreshToken = previous.data()?.refreshToken as string | undefined;
    await ref.set({
      provider: "google_calendar",
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? previousRefreshToken,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      clientId,
      scope: token.scope,
      updatedAt: FieldValue.serverTimestamp(),
    });
    response.status(200).json({ connected: true });
  } catch {
    response.status(502).json({ error: "Google authorization failed" });
  }
});

export const googleCalendarStatus = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, "GET", "googleCalendarStatus");
  if (!uid) return;
  response.status(200).json({ connected: (await connectionRef(uid).get()).exists });
});

export const googleCalendarSync = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, "POST", "googleCalendarSync");
  if (!uid) return;
  try {
    const connection = await getActiveConnection(uid);
    const events = await fetchEvents(connection.accessToken);
    response.status(200).json({ events, syncedAt: Date.now() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "sync_failed";
    response.status(code === "not_connected" || code === "reconnect_required" ? 401 : 502).json({
      error: code === "reconnect_required" ? "Reconnect Google Calendar" : "Calendar sync failed",
    });
  }
});

export const googleCalendarDisconnect = onRequest(functionOptions, async (request, response) => {
  const uid = await validateRequest(request, response, "POST", "googleCalendarDisconnect");
  if (!uid) return;
  await disconnectGoogleCalendarForUser(uid);
  response.status(200).json({ connected: false });
});
