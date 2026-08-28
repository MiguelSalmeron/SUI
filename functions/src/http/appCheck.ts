import * as logger from "firebase-functions/logger";
import { getAppCheck } from "firebase-admin/app-check";
import { APP_CHECK_MODE } from "../chat/config";
import "../chat/firebase";

export async function verifyAppCheckHeader(
  token: string | undefined,
  operation: string,
): Promise<boolean> {
  const mode = APP_CHECK_MODE.value();
  if (mode === "off") return true;
  if (!token) {
    logger.warn("App Check token missing", { operation, mode });
    return mode !== "enforce";
  }
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch (error) {
    logger.warn("App Check token invalid", {
      operation,
      mode,
      error: error instanceof Error ? error.message : String(error),
    });
    return mode !== "enforce";
  }
}
