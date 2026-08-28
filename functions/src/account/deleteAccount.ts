import { onRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { authenticateBearer } from "../chat/auth";
import { firestore } from "../chat/firebase";
import { disconnectGoogleCalendarForUser } from "../connections/googleCalendar";
import { verifyAppCheckHeader } from "../http/appCheck";
import { setCorsHeaders } from "../http/cors";

export const deleteAccount = onRequest(
  { cors: false, timeoutSeconds: 60, memory: "256MiB" },
  async (request, response) => {
    if (!setCorsHeaders(request, response)) {
      response.status(403).json({ error: "Origin not allowed" });
      return;
    }
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }
    const appCheckOk = await verifyAppCheckHeader(
      typeof request.headers["x-firebase-appcheck"] === "string"
        ? request.headers["x-firebase-appcheck"]
        : undefined,
      "deleteAccount",
    );
    if (!appCheckOk) {
      response.status(401).json({ error: "Invalid App Check token" });
      return;
    }
    const authentication = await authenticateBearer(request.headers.authorization);
    if (!authentication.ok) {
      response.status(401).json({ error: "Invalid authentication" });
      return;
    }
    const uid = authentication.uid;
    try {
      await disconnectGoogleCalendarForUser(uid);
      await firestore.recursiveDelete(firestore.collection("users").doc(uid));
      await getAuth().deleteUser(uid);
      response.status(200).json({ deleted: true });
    } catch {
      response.status(500).json({ error: "Account deletion failed" });
    }
  },
);
