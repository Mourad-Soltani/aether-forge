import type { IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";

export function configuredApiToken(): string | undefined {
  const raw = process.env.AETHER_API_TOKEN?.trim();
  return raw ? raw : undefined;
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function extractPresentedToken(req: IncomingMessage): string | undefined {
  const dedicated = headerValue(req, "x-aether-token")?.trim();
  if (dedicated) return dedicated;
  const auth = headerValue(req, "authorization")?.trim();
  if (!auth) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1]?.trim();
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Returns true when the request may proceed. Health/OPTIONS are not gated here. */
export function isAuthorized(req: IncomingMessage): boolean {
  const expected = configuredApiToken();
  if (!expected) return true;
  const presented = extractPresentedToken(req);
  if (!presented) return false;
  return safeEqual(presented, expected);
}
