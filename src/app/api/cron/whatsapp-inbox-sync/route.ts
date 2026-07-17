import { NextRequest, NextResponse } from "next/server";
import { writeWebhookLog } from "@/services/whatsapp-audit-service";
import { processInboxBackfillTick } from "@/services/whatsapp-inbox-sync-service";

export const maxDuration = 60;

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_AUDIENCE = "ilj-hub:whatsapp-inbox-sync";
const GITHUB_REPOSITORY = "LostaMasta45/biolink";
type GitHubJwk = JsonWebKey & { kid?: string };

function decodeJwtPart<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as T;
  } catch { return null; }
}

function jwtBytes(value: string) {
  return Uint8Array.from(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

async function validGitHubActionsToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length);
  const [headerPart, payloadPart, signaturePart, extra] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extra) return false;
  const header = decodeJwtPart<{ alg?: string; kid?: string }>(headerPart);
  const claims = decodeJwtPart<{ iss?: string; aud?: string | string[]; exp?: number; nbf?: number; repository?: string; ref?: string; event_name?: string; workflow_ref?: string }>(payloadPart);
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (header?.alg !== "RS256" || !header.kid || !claims || claims.iss !== GITHUB_ISSUER || !audiences.includes(GITHUB_AUDIENCE) || !claims.exp || claims.exp <= now || (claims.nbf && claims.nbf > now + 30) || claims.repository !== GITHUB_REPOSITORY || claims.ref !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(claims.event_name ?? "")) return false;

  try {
    const response = await fetch(`${GITHUB_ISSUER}/.well-known/jwks`, { cache: "force-cache" });
    const payload = await response.json() as { keys?: GitHubJwk[] };
    const jwk = payload.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, jwtBytes(signaturePart), new TextEncoder().encode(`${headerPart}.${payloadPart}`));
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const validVercelCron = Boolean(secret && authorization === `Bearer ${secret}`);
  if (!validVercelCron && !await validGitHubActionsToken(authorization)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processInboxBackfillTick();
    await writeWebhookLog("outgoing", "inbox.backfill.worker", "success", result, Date.now() - startedAt);
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker sinkronisasi Inbox gagal";
    await writeWebhookLog("outgoing", "inbox.backfill.worker", "failed", { error: message }, Date.now() - startedAt);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
