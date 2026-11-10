const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  babel = require("@babel/core");
function moduleAt(
  file,
  { storage = new Map(), secure = new Map(), fetch } = {},
) {
  const source = fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    exports = {};
  const code = babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const context = {
    exports,
    require: (n) =>
      n.includes("secure-store")
        ? {
            getItemAsync: async (k) => secure.get(k) || null,
            setItemAsync: async (k, v) => secure.set(k, v),
          }
        : {
            getItem: async (k) => storage.get(k) || null,
            setItem: async (k, v) => storage.set(k, v),
            removeItem: async (k) => storage.delete(k),
          },
    process: { env: { EXPO_PUBLIC_API_BASE_URL: "https://example.invalid" } },
    setTimeout,
    clearTimeout,
    AbortController,
    URLSearchParams,
    fetch,
    Intl,
    Date,
  };
  vm.runInNewContext(code, context);
  return exports;
}
const response = (status, data) => ({
  status,
  ok: status < 400,
  text: async () => JSON.stringify(data),
});
test("new installation stores secrets in native secure storage and preserves identity", async () => {
  const storage = new Map(),
    secure = new Map(),
    calls = [];
  const api = moduleAt("utils/api.js", {
    storage,
    secure,
    fetch: async (url, o) => {
      calls.push([url, o]);
      return response(200, {
        openid: "android_original",
        token: "short-lived",
        refreshToken: "opaque-refresh",
        recoveryKey: "REC-backup",
      });
    },
  });
  await api.initializeIdentity();
  assert.equal((await api.identity()).openid, "android_original");
  assert.equal([...storage.values()].includes("opaque-refresh"), false);
  assert.ok([...secure.values()].includes("REC-backup"));
  assert.equal(calls.length, 1);
});
test("concurrent expired requests share one refresh and retry with new token", async () => {
  const storage = new Map([
      ["recorder.https___example.invalid.openid", "original"],
    ]),
    secure = new Map([
      ["recorder.https___example.invalid.token", "expired"],
      ["recorder.https___example.invalid.refresh", "refresh"],
    ]);
  let refreshes = 0;
  const api = moduleAt("utils/api.js", {
    storage,
    secure,
    fetch: async (url, o) => {
      if (url.endsWith("/refresh")) {
        refreshes++;
        await new Promise((r) => setTimeout(r, 5));
        return response(200, {
          openid: "original",
          token: "renewed",
          refreshToken: "rotated",
        });
      }
      return o.headers.Authorization === "Bearer expired"
        ? response(401, { code: "AUTH_REQUIRED", error: "expired" })
        : response(200, { items: [] });
    },
  });
  await Promise.all(Array.from({ length: 6 }, () => api.get("/api/history")));
  assert.equal(refreshes, 1);
  assert.equal((await api.identity()).openid, "original");
});
test("school authentication failures do not refresh or replace app identity", async () => {
  let calls = 0;
  const api = moduleAt("utils/api.js", {
    fetch: async () => {
      calls++;
      return response(401, {
        code: "SCHOOL_AUTH_REQUIRED",
        error: "学校登录已失效",
      });
    },
  });
  await assert.rejects(
    api.get("/api/auth/student-list"),
    (e) => e.code === "SCHOOL_AUTH_REQUIRED",
  );
  assert.equal(calls, 1);
});
test("expired legacy identity never silently creates a different account", async () => {
  const storage = new Map([
    ["openid", "old-id"],
    ["authToken", "old-token"],
    ["authServer", "https://example.invalid"],
  ]);
  let calls = 0;
  const api = moduleAt("utils/api.js", {
    storage,
    fetch: async () => {
      calls++;
      return response(401, { code: "SESSION_RECOVERY_REQUIRED" });
    },
  });
  await assert.rejects(
    api.initializeIdentity(),
    (e) => e.code === "LEGACY_RECOVERY_REQUIRED",
  );
  assert.equal(calls, 1);
  assert.equal(storage.get("openid"), "old-id");
});
test("HTML, offline and timeouts are distinguishable from a school login problem", async () => {
  const invalid = moduleAt("utils/api.js", {
    fetch: async () => ({
      status: 502,
      ok: false,
      text: async () => "<html>bad gateway</html>",
    }),
  });
  await assert.rejects(
    invalid.get("/api/history"),
    (e) => e.code === "INVALID_RESPONSE",
  );
  const offline = moduleAt("utils/api.js", {
    fetch: async () => {
      throw Error("network");
    },
  });
  await assert.rejects(
    offline.get("/api/history"),
    (e) => e.code === "NETWORK_ERROR",
  );
});
test("week dates use China timezone and reject dates outside selected week", () => {
  const c = moduleAt("utils/calendar.js");
  assert.equal(
    c.formatActivity(new Date("2026-08-31T01:00:00Z")),
    "2026-08-31 09:00:00",
  );
  assert.equal(
    c.validSchedule("2026-09-07 09:00:00", { startDate: "2026-08-31" }, 1),
    false,
  );
  assert.equal(
    c.validSchedule("2026-08-31 09:00:00", { startDate: "2026-08-31" }, 1),
    true,
  );
});
test("failed, cancelled and running tasks never have completed wording", () => {
  const p = moduleAt("utils/presentation.js");
  for (const status of [
    "failed",
    "cancelled",
    "running",
    "interrupted",
    "partial_failed",
  ])
    assert.ok(
      !p.outcome({ status }).includes("完成") || status === "partial_failed",
    );
  assert.equal(
    p.outcome({ status: "completed", progress: { success: 0 } }),
    "检查完成，无需新增",
  );
  assert.ok(!p.taskTitle({ type: "talk", weeks: [] }).includes("第0周"));
});
test("all screens parse for release bundling", () => {
  const root = path.join(__dirname, "../src");
  function visit(dir) {
    for (const f of fs.readdirSync(dir)) {
      const file = path.join(dir, f);
      if (fs.statSync(file).isDirectory()) visit(file);
      else if (file.endsWith(".js"))
        babel.transformFileSync(file, { presets: ["babel-preset-expo"] });
    }
  }
  visit(root);
});
