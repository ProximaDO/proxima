import { randomUUID } from "node:crypto";

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    return firstIp.trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
