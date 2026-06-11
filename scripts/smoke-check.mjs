function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK: ${message}`);
}

function getBaseUrl() {
  const fromArg = process.argv[2]?.trim();
  if (fromArg) return fromArg;

  const fromEnv =
    process.env.SMOKE_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  return fromEnv || "http://localhost:3000";
}

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { response, text, json };
}

async function main() {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  console.log(`Running smoke check against: ${baseUrl}`);

  const health = await request(`${baseUrl}/api/health`);
  if (health.response.status !== 200) {
    fail(`/api/health expected 200, got ${health.response.status}`);
  } else if (!health.json || health.json.ok !== true) {
    fail(`/api/health expected { ok: true }, got: ${health.text}`);
  } else {
    pass("/api/health returns 200 and ok=true");
  }

  const secHeaders = [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
  ];

  for (const key of secHeaders) {
    if (!health.response.headers.get(key)) {
      fail(`/api/health missing security header: ${key}`);
    } else {
      pass(`/api/health includes header ${key}`);
    }
  }

  const protectedRoutes = ["/api/notifications/dispatch", "/api/withdrawals/process"];

  for (const route of protectedRoutes) {
    const res = await request(`${baseUrl}${route}`);
    if (res.response.status !== 401 && res.response.status !== 429) {
      fail(`${route} expected 401 or 429 without token, got ${res.response.status}`);
    } else {
      pass(`${route} blocks unauthenticated access (${res.response.status})`);
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error("Smoke check finished with failures");
    process.exit(process.exitCode);
  }

  console.log("Smoke check finished successfully");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
