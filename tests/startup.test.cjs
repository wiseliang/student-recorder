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
  assert.ok(!p.taskTitle({ type: "talk", weeks: [0] }).includes("第0周"));
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

test("work-log semester conversations have an independent title", () => {
  const p = moduleAt("utils/presentation.js");
  assert.equal(
    p.taskTitle({ type: "worklog-talk", weeks: [1, 3, 5] }),
    "工作日志 · 学期谈话",
  );
  assert.notEqual(
    p.taskTitle({ type: "talk", weeks: [1] }),
    p.taskTitle({ type: "worklog-talk", weeks: [1] }),
  );
});

test("expired roster recovery handles both log sources and keeps valid semester weeks", () => {
  const r = moduleAt("utils/flowRecovery.js");
  for (const code of [
    "SNAPSHOT_EXPIRED",
    "SNAPSHOT_NOT_FOUND",
    "ACADEMIC_SNAPSHOT_EXPIRED",
    "ACADEMIC_SNAPSHOT_NOT_FOUND",
    "PLAN_EXPIRED",
  ])
    assert.equal(r.needsRosterReload({ code }), true);
  assert.equal(r.needsRosterReload({ code: "SCHOOL_AUTH_REQUIRED" }), false);
  assert.equal(r.needsRosterReload({ code: "NETWORK_ERROR" }), false);
  assert.equal(
    r.snapshotIsExpired(
      { expiresAt: "2026-11-10T00:00:00Z" },
      Date.parse("2026-11-10T00:00:01Z"),
    ),
    true,
  );
  assert.equal(r.snapshotIsExpired({ expired: true }), true);
  assert.equal(r.snapshotIsExpired({ expiresAt: "invalid" }), false);
  assert.deepEqual(
    Array.from(r.refreshWeeks([3, 2, 2, 99], { week: 4 }, "automatic")),
    [2, 3],
  );
  assert.deepEqual(
    Array.from(r.refreshWeeks([], { week: 3 }, "automatic")),
    [1, 2, 3],
  );
});

test("search normalizes spaces and mixed case and filtering never changes hidden selections", () => {
  const { filterPeople, retainSelection } = moduleAt("utils/people.js"),
    students = [
      { studentId: "2022000001", name: "甲", major: "CS", missingWeeks: [] },
      { studentId: "2022000002", name: "乙", major: "CS", missingWeeks: [1] },
    ],
    selected = new Set(students.map((s) => s.studentId));
  assert.equal(
    filterPeople(students, " cs  2022000002 ", "all", selected).length,
    1,
  );
  assert.equal(
    filterPeople(
      students,
      "",
      "missing",
      selected,
      (s) => s.missingWeeks.length > 0,
    )[0].studentId,
    "2022000002",
  );
  assert.equal(selected.size, 2);
  assert.equal(
    retainSelection(["2022000001", "2023000001", "2022000001"], students).join(
      ",",
    ),
    "2022000001",
  );
  assert.equal(
    filterPeople([{ studentId: "2023000001", name: "甲" }], "", "all", selected)
      .length,
    1,
  );
});
test("a school expiry after app token refresh goes to school connection, preserving app identity", async () => {
  const storage = new Map([
      ["recorder.https___example.invalid.openid", "original"],
    ]),
    secure = new Map([
      ["recorder.https___example.invalid.token", "expired"],
      ["recorder.https___example.invalid.refresh", "refresh"],
    ]);
  let school = 0,
    lost = 0;
  const api = moduleAt("utils/api.js", {
    storage,
    secure,
    fetch: async (url, o) =>
      url.endsWith("/refresh")
        ? response(200, {
            openid: "original",
            token: "renewed",
            refreshToken: "rotated",
          })
        : o.headers.Authorization === "Bearer expired"
          ? response(401, { code: "AUTH_REQUIRED" })
          : response(401, { code: "SCHOOL_AUTH_REQUIRED" }),
  });
  api.onSchoolExpired(() => school++);
  api.onIdentityLost(() => lost++);
  await assert.rejects(
    api.get("/api/worklog/scan"),
    (e) => e.code === "SCHOOL_AUTH_REQUIRED",
  );
  assert.equal(school, 1);
  assert.equal(lost, 0);
  assert.equal((await api.identity()).openid, "original");
});
test("result labels distinguish unarranged, not yet due and uncertain saves", () => {
  const { operationLabel } = moduleAt("utils/presentation.js");
  assert.equal(operationLabel({ status: "skipped" }), "已有记录，已跳过");
  assert.equal(
    operationLabel({ status: "not_applicable", reason: "尚未到时间" }),
    "尚未到时间，未录入",
  );
  assert.match(
    operationLabel({ status: "not_applicable", reason: "学校缺少联系方式" }),
    /未安排/,
  );
  assert.match(operationLabel({ status: "unconfirmed" }), /待回查/);
});

test('login completion waits for the pre-login status read before fetching the fresh connection',async()=>{
 let calls=0,release;const old=new Promise(r=>release=r),states=[];
 const react={createContext:()=>({Provider:'provider'}),useState:(value)=>{const i=states.length;states.push(value);return [value,next=>{states[i]=typeof next==='function'?next(states[i]):next}]},useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:()=>{},createElement:(_component,props)=>props};
 const code=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/state/SchoolContext.js'),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code,exports={};
 vm.runInNewContext(code,{exports,require:n=>n==='react'?react:n==='react-native'?{AppState:{}}:{get:async()=>++calls===1?old:{hasActiveSession:true,calendar:{startDate:'2026-08-31'}},onSchoolExpired:()=>{}},Date});
 const {value}=exports.SchoolProvider({children:null});const stale=value.refresh(),connected=value.connected({startDate:'2026-08-31'});
 assert.equal(calls,1);release({hasActiveSession:false});await stale;await connected;
 assert.equal(calls,2);assert.equal(states[0].hasActiveSession,true);assert.equal(states[0].loading,false);
});
