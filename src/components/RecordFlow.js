import { retainSelection } from "../utils/people";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Choice,
  Field,
  ErrorBox,
  StepHeader,
  SectionHeader,
  colors,
} from "./ui";
import Dropdown from "./Dropdown";
import SchoolGate from "./SchoolGate";
import PeoplePicker, { PeopleSummary } from "./PeoplePicker";
import { DateField, ExcludedDates, WorkHours } from "./DateControls";
import PlanPreview from "./PlanPreview";
import { useSchool } from "../state/SchoolContext";
import { get, post, currentPlan, cacheRead, cacheWrite } from "../utils/api";
import { useForeground } from "../utils/useForeground";
import {
  needsRosterReload,
  snapshotIsExpired,
  refreshWeeks,
} from "../utils/flowRecovery";
export default function RecordFlow({ route, navigation, worklog = false }) {
  const { school } = useSchool(),
    calendar = school.calendar,
    entry = route.params?.entry || route.params?.type || "talk",
    scope = worklog ? "工作日志管理" : "学情日志",
    label = worklog
      ? "学期谈话"
      : entry === "automatic"
        ? "一键录入"
        : entry === "companion"
          ? "陪伴录入"
          : "谈话录入",
    api = worklog ? "/api/worklog" : "/api/academic";
  const [step, S] = useState(0),
    [weeks, W] = useState([]),
    [snapshot, Z] = useState(null),
    [ids, I] = useState([]),
    [people, O] = useState(false),
    [content, C] = useState(""),
    [duration, D] = useState("10"),
    [method, M] = useState("面对面"),
    [scene, SC] = useState("其他"),
    [pbType, PB] = useState("共同上课"),
    [advanced, A] = useState(false),
    [shifts, H] = useState([
      ["09:00", "12:00"],
      ["14:00", "17:00"],
    ]),
    [excluded, X] = useState([]),
    [from, F] = useState(""),
    [to, T] = useState(""),
    [skip, SK] = useState(true),
    [target, TG] = useState("1"),
    [plan, P] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [hydrating, Y] = useState(true),
    [notice, NT] = useState(null),
    [schoolOptions, SO] = useState({ scenes: [], companionTypes: [] });
  const foreground = useForeground(),
    alive = useRef(true),
    lock = useRef(false),
    latest = useRef(null),
    restoreIds = useRef(null),
    selectionInitialized = useRef(false),
    selectedRef = useRef(ids),
    weeksRef = useRef(weeks),
    recovering = useRef(false),
    pendingReload = useRef(false),
    pendingAction = useRef(null),
    retryLoaded = useRef(false),
    draftStep = useRef(0),
    draftKey = `draft.${worklog ? "worklog" : "academic"}.${entry}`,
    today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    });
  selectedRef.current = ids;
  weeksRef.current = weeks;
  useEffect(() => {
    let live = true;
    get("/api/academic/options")
      .then((r) => {
        if (live) SO(r);
        return cacheWrite("academicOptions", r);
      })
      .catch(async (e) => {
        const cached = await cacheRead("academicOptions");
        if (live) {
          if (cached) SO(cached);
          else E(e);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  const beginRead = async (selectedWeeks) => {
    const range = refreshWeeks(
      selectedWeeks || weeksRef.current,
      calendar,
      entry,
    );
    if (!worklog) W(range);
    const r = await post(
      api + (worklog ? "/scan" : "/rosters"),
      worklog ? {} : { weeks: range, entry },
    );
    await cacheWrite(
      worklog ? "worklogScanId" : "academicScanId",
      r.snapshotId,
    );
    if (alive.current) Z({ id: r.snapshotId, state: "scanning", students: [] });
  };
  const recoverSnapshot = async (context = {}) => {
    if (recovering.current) return;
    recovering.current = true;
    try {
      if (!alive.current) return;
      S(0);
      P(null);
      O(false);
      Z(null);
      E(null);
      restoreIds.current = selectionInitialized.current
        ? [...selectedRef.current]
        : null;
      NT("名单次数已过期，正在自动重新读取…");
      await currentPlan(null);
      await cacheWrite(worklog ? "worklogScanId" : "academicScanId", null);
      if (!school.hasActiveSession) {
        pendingReload.current = true;
        return;
      }
      await beginRead(context.weeks);
    } catch (e) {
      if (alive.current) {
        NT(null);
        E(e);
      }
    } finally {
      recovering.current = false;
    }
  };
  const run = async (fn, resume = false) => {
    if (lock.current) return false;
    lock.current = true;
    B(true);
    E(null);
    try {
      await fn();
      return true;
    } catch (e) {
      if (alive.current && needsRosterReload(e)) await recoverSnapshot();
      else if (
        alive.current &&
        ["SCHOOL_AUTH_REQUIRED", "SCHOOL_LOGIN_FAILED"].includes(e.code)
      ) {
        pendingAction.current = resume ? fn : null;
        NT(
          resume
            ? "学校需要重新连接，已保留填写内容，连接后继续检查。"
            : "已保留预览。连接学校后请核对并再次确认录入。",
        );
        navigation.navigate("SchoolLogin", { force: true });
      } else if (alive.current && e.code !== "ABORTED") E(e);
      return false;
    } finally {
      lock.current = false;
      if (alive.current) B(false);
    }
  };
  const applySnapshot = (s) => {
    if (snapshotIsExpired(s)) {
      void recoverSnapshot({ weeks: s.weeks });
      return;
    }
    Z(s);
    if (s.state === "ready")
      NT((old) => (old ? "名单与次数已重新读取，请核对人员后继续。" : null));
    if (s.state === "ready" && latest.current !== s.id) {
      latest.current = s.id;
      selectionInitialized.current = true;
      const valid = s.students.map((x) => x.studentId);
      I(
        restoreIds.current
          ? retainSelection(restoreIds.current, s.students)
          : valid,
      );
      restoreIds.current = null;
      if (draftStep.current === 1) {
        S(1);
        draftStep.current = 0;
      }
    }
  };
  const applyPlan = (p) => {
    if (p.id) draftStep.current = 0;
    const r = p.request || {};
    restoreIds.current = r.studentIds || null;
    if (r.studentIds) {
      selectionInitialized.current = true;
      selectedRef.current = r.studentIds;
    }
    P(p);
    S(2);
    if (r.weeks) W(r.weeks);
    if (r.studentIds) I(r.studentIds);
    C(r.content || "");
    D(String(r.durationMinutes || 10));
    M(r.method || "面对面");
    SC(r.scene || "其他");
    PB(r.pbType || "共同上课");
    if (r.shifts) H(r.shifts);
    X(r.excludeDates || []);
    if (r.fromDate) F(r.fromDate);
    if (r.toDate) T(r.toDate);
    SK(r.skipRecorded !== false);
    TG(String(r.targetCount || 1));
  };
  useEffect(() => {
    if (calendar) {
      W((old) =>
        old.length
          ? old
          : entry === "automatic" && !worklog
            ? Array.from({ length: calendar.week }, (_, i) => i + 1)
            : [calendar.week],
      );
      F((old) => old || calendar.startDate);
      T((old) => old || today);
    }
  }, [calendar?.startDate]);
  useEffect(() => {
    if (school.loading) return;
    alive.current = true;
    (async () => {
      try {
        const draft = await cacheRead(draftKey);
        if (
          draft &&
          (!calendar?.startDate ||
            draft.calendarStartDate === calendar.startDate) &&
          !route.params?.retryTaskUuid
        ) {
          applyPlan({ request: draft });
          P(null);
          S(0);
          draftStep.current = draft.step === 1 ? 1 : 0;
        }
        if (route.params?.retryTaskUuid) {
          const p = await post(
            "/api/task/" + route.params.retryTaskUuid + "/retry-plan",
          );
          if (alive.current) {
            applyPlan(p);
            await currentPlan(p.id);
            retryLoaded.current = true;
          }
          return;
        }
        if (route.params?.overviewPrefill) {
          const prefill = route.params.overviewPrefill;
          restoreIds.current = prefill.studentIds;
          selectedRef.current = prefill.studentIds;
          selectionInitialized.current = true;
          I(prefill.studentIds);
          if (worklog) TG(String(prefill.targetCount || 1));
          else W(prefill.weeks);
          P(null);
          S(0);
          NT("总览仅带入补录范围，正在重新读取学校最新名单、次数和轮次。");
          await beginRead(prefill.weeks);
          return;
        }
        const id = await currentPlan();
        if (id) {
          const p = await get("/api/task/plans/" + id);
          if (
            alive.current &&
            (worklog
              ? p.request?.recordType === "worklog-talk"
              : p.request?.scope === "academic" && p.request.entry === entry)
          ) {
            applyPlan(p);
          }
        }
        const scan = await cacheRead(
          worklog ? "worklogScanId" : "academicScanId",
        );
        if (scan) {
          const s = await get(api + (worklog ? "/scans/" : "/rosters/") + scan);
          if (alive.current && (worklog || s.entry === entry)) {
            applySnapshot(s);
            if (!worklog && s.weeks) W(s.weeks);
          }
        }
      } catch (e) {
        if (alive.current && needsRosterReload(e)) await recoverSnapshot();
        else if (
          alive.current &&
          ["SCHOOL_AUTH_REQUIRED", "SCHOOL_LOGIN_FAILED"].includes(e.code)
        ) {
          navigation.navigate("SchoolLogin", { force: true });
        } else if (alive.current) E(e);
      } finally {
        if (alive.current) Y(false);
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [school.loading]);
  useEffect(() => {
    if (!foreground) return;
    const scanning = snapshot?.state === "scanning",
      planning = plan?.state === "scanning";
    if (!scanning && !planning) return;
    let stopped = false,
      timer;
    const poll = async () => {
      try {
        if (scanning) {
          const s = await get(
            api + (worklog ? "/scans/" : "/rosters/") + snapshot.id,
          );
          if (!stopped) applySnapshot(s);
          if (s.state !== "scanning") return;
        } else {
          const p = await get("/api/task/plans/" + plan.id);
          if (!stopped) P(p);
          if (p.state !== "scanning") return;
        }
        if (!stopped) timer = setTimeout(poll, 1400);
      } catch (e) {
        if (!stopped) {
          if (needsRosterReload(e)) {
            await recoverSnapshot();
            return;
          }
          E(e);
          timer = setTimeout(poll, 5000);
        }
      }
    };
    timer = setTimeout(poll, 400);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [snapshot?.id, snapshot?.state, plan?.id, plan?.state, foreground]);
  useEffect(() => {
    if (pendingReload.current && school.hasActiveSession) {
      pendingReload.current = false;
      void recoverSnapshot();
    }
  }, [school.hasActiveSession]);
  useEffect(() => {
    if (!foreground || snapshot?.state !== "ready" || !snapshot.expiresAt)
      return;
    const expiry = Date.parse(snapshot.expiresAt);
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(
      () => void recoverSnapshot(),
      Math.max(0, expiry - Date.now() + 30),
    );
    return () => clearTimeout(timer);
  }, [foreground, snapshot?.id, snapshot?.state, snapshot?.expiresAt]);
  useEffect(() => {
    if (!foreground || !school.hasActiveSession || hydrating) return;
    if (route.params?.retryTaskUuid && !retryLoaded.current && !lock.current) {
      void run(async () => {
        const p = await post(
          "/api/task/" + route.params.retryTaskUuid + "/retry-plan",
        );
        if (alive.current) {
          applyPlan(p);
          await currentPlan(p.id);
          retryLoaded.current = true;
        }
      });
    } else if (pendingAction.current && !lock.current) {
      const action = pendingAction.current;
      pendingAction.current = null;
      void run(action, true);
    }
  }, [foreground, school.hasActiveSession, hydrating]);
  useEffect(() => {
    if (hydrating || !calendar?.startDate || route.params?.retryTaskUuid)
      return;
    const timer = setTimeout(() => {
      void cacheWrite(draftKey, {
        calendarStartDate: calendar.startDate,
        step: Math.min(step, 1),
        weeks,
        studentIds: ids,
        content,
        durationMinutes: Number(duration),
        method,
        scene,
        pbType,
        shifts,
        excludeDates: excluded,
        fromDate: from,
        toDate: to,
        skipRecorded: skip,
        targetCount: Number(target),
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [
    hydrating,
    calendar?.startDate,
    step,
    weeks,
    ids,
    content,
    duration,
    method,
    scene,
    pbType,
    shifts,
    excluded,
    from,
    to,
    skip,
    target,
  ]);
  const load = () =>
    run(async () => {
      NT(null);
      if (selectionInitialized.current)
        restoreIds.current = [...selectedRef.current];
      await beginRead();
    }, true);
  const preview = () =>
    run(async () => {
      if (snapshotIsExpired(snapshot)) {
        await recoverSnapshot();
        return;
      }
      if (snapshot?.state !== "ready") throw Error("名单正在读取，请稍候");
      if (!ids.length) throw Error("请至少选择一位学生");
      const r = await post(api + "/preview", {
        snapshotId: snapshot.id,
        studentIds: ids,
        content,
        durationMinutes: Number(duration),
        method,
        scene,
        pbType,
        shifts,
        excludeDates: excluded,
        ...(worklog
          ? {
              targetCount: Number(target),
              skipRecorded: skip,
              fromDate: from,
              toDate: to,
            }
          : {}),
      });
      const p = r.id ? r : { id: r.planId, state: "scanning" };
      P(p);
      S(2);
      await currentPlan(p.id);
    }, true);
  const edit = (change) =>
    run(async () =>
      P(
        await post(api + "/plans/" + plan.id + "/review", {
          revision: plan.revision,
          changes: [change],
        }),
      ),
    );
  const submit = () =>
    run(async () => {
      const r = await post("/api/task/create", {
        planId: plan.id,
        requestId: plan.id,
        revision: plan.revision,
        confirmedActual: true,
      });
      await currentPlan(null);
      await cacheWrite(draftKey, null);
      navigation.replace("Progress", { taskUuid: r.taskUuid });
    });
  const rosterReady =
      snapshot?.state === "ready" && !snapshotIsExpired(snapshot),
    students = snapshot?.students || [],
    footer = school.hasActiveSession ? (
      <>
        <Button
          title={
            step === 0
              ? "下一步 · 设置规则"
              : step === 1
                ? "生成预览"
                : plan?.usedBy
                  ? "查看已提交任务"
                  : `确认实际记录并录入 ${plan?.summary?.planned || 0} 项`
          }
          loading={busy || hydrating}
          disabled={
            step === 0
              ? hydrating || !rosterReady || !ids.length
              : step === 1
                ? !rosterReady || !ids.length
                : plan?.state !== "ready" || !!plan?.summary?.unconfirmed
          }
          onPress={
            step === 0
              ? () => S(1)
              : step === 1
                ? preview
                : plan?.usedBy
                  ? () =>
                      navigation.navigate("Progress", { taskUuid: plan.usedBy })
                  : submit
          }
        />
        {step > 0 && (
          <Button
            secondary
            title={
              step === 2
                ? rosterReady
                  ? "返回规则"
                  : "重新选择范围"
                : "返回范围"
            }
            disabled={busy || plan?.state === "scanning"}
            onPress={() =>
              run(async () => {
                if (step === 2) {
                  await currentPlan(null);
                  P(null);
                }
                S(step === 2 && !rosterReady ? 0 : step - 1);
              })
            }
          />
        )}
      </>
    ) : null;
  return (
    <Page key={step} footer={footer}>
      <StepHeader steps={["选择范围", "设置规则", "核对录入"]} current={step} />
      <View style={{ gap: 6 }}>
        <Title>{label}</Title>
        <Body muted>
          {scope}
          {!worklog && entry === "automatic"
            ? " · 按周交替优先，补足学校次数与轮次"
            : ""}
        </Body>
      </View>
      {notice && (
        <Card style={{ backgroundColor: colors.tint }}>
          <Body>{notice}</Body>
        </Card>
      )}
      <ErrorBox
        error={error}
        onLogin={
          error?.status === 401
            ? () => navigation.navigate("SchoolLogin")
            : undefined
        }
      />
      <SchoolGate navigation={navigation}>
        <>
          {step === 0 && (
            <>
              <Card>
                {!worklog && (
                  <>
                    <SectionHeader
                      title="选择周次"
                      action="选到本周"
                      onPress={() => {
                        W(
                          Array.from(
                            { length: calendar?.week || 0 },
                            (_, i) => i + 1,
                          ),
                        );
                        Z(null);
                      }}
                    />
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {Array.from(
                        { length: calendar?.week || 0 },
                        (_, i) => i + 1,
                      ).map((w) => (
                        <Pressable
                          key={w}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`第${w}周`}
                          accessibilityState={{ checked: weeks.includes(w) }}
                          disabled={snapshot?.state === "scanning"}
                          onPress={() => {
                            W((old) =>
                              old.includes(w)
                                ? old.filter((x) => x !== w)
                                : [...old, w].sort((a, b) => a - b),
                            );
                            Z(null);
                          }}
                          style={{
                            minWidth: 50,
                            minHeight: 48,
                            borderRadius: 12,
                            justifyContent: "center",
                            alignItems: "center",
                            backgroundColor: weeks.includes(w)
                              ? colors.primary
                              : colors.soft,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              color: weeks.includes(w) ? "#FFF" : colors.ink,
                            }}
                          >
                            {w} 周
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Body muted>
                      已选 {weeks.length} 周；仅使用各周学情日志自己的名册。
                    </Body>
                  </>
                )}
                <SectionHeader
                  title={worklog ? "本学期名单与次数" : "同步学情名单"}
                />
                <Body muted>
                  {worklog
                    ? "来自工作日志管理，和学情日志分别选择。"
                    : "按所选周次核对人员，不从工作日志借用学生。"}
                </Body>
                <Button
                  title={rosterReady ? "重新读取名单" : "读取名单与已有记录"}
                  secondary
                  loading={busy || hydrating || snapshot?.state === "scanning"}
                  disabled={
                    !school.hasActiveSession || (!worklog && !weeks.length)
                  }
                  onPress={load}
                />
                {snapshot?.state === "scanning" && (
                  <>
                    <Body muted>
                      正在读取 {snapshot.progress?.processed || 0} /{" "}
                      {snapshot.progress?.total || "…"}，可稍后回来继续。
                    </Body>
                    <Button
                      title="停止读取"
                      secondary
                      onPress={() =>
                        run(async () => {
                          await post(
                            api +
                              (worklog ? "/scans/" : "/rosters/") +
                              snapshot.id +
                              "/cancel",
                          );
                          applySnapshot(
                            await get(
                              api +
                                (worklog ? "/scans/" : "/rosters/") +
                                snapshot.id,
                            ),
                          );
                        })
                      }
                    />
                  </>
                )}
                {snapshot?.error && (
                  <Body style={{ color: colors.danger }}>{snapshot.error}</Body>
                )}
                {rosterReady && (
                  <PeopleSummary
                    count={ids.length}
                    total={students.length}
                    scope={scope}
                    onPress={() => O(true)}
                  />
                )}
              </Card>
              {rosterReady && worklog && (
                <Card>
                  <Choice
                    label="跳过已达到目标次数的学生"
                    detail="依据本学期已完成谈话次数"
                    selected={skip}
                    onPress={() => SK(!skip)}
                  />
                  <Field
                    label={
                      skip
                        ? "每人学期目标次数（1–10）"
                        : "每人本次新增次数（1–10）"
                    }
                    value={target}
                    onChangeText={TG}
                    keyboardType="number-pad"
                  />
                </Card>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <Card>
                <SectionHeader title="自动安排时间" />
                <Body muted>
                  {worklog
                    ? "在本学期可用日期之间尽量均匀分布。"
                    : "自动安排在所选周的工作日白天，生成后逐条核对。"}
                  仅安排已过去的时段，10 分钟内最多 2 人。
                </Body>
                {worklog && (
                  <>
                    <DateField
                      label="起始日期"
                      value={from}
                      onChange={F}
                      minDate={calendar?.startDate}
                      maxDate={today}
                    />
                    <DateField
                      label="截止日期"
                      value={to}
                      onChange={T}
                      minDate={from}
                      maxDate={today}
                    />
                  </>
                )}
                <ExcludedDates
                  value={excluded}
                  onChange={X}
                  minDate={calendar?.startDate}
                  maxDate={today}
                />
              </Card>
              <Card>
                <Field
                  label="谈话 / 工作内容（选填）"
                  helper="可以留空，也可在预览中逐人修改，最多 250 字。"
                  value={content}
                  onChangeText={C}
                  multiline
                  maxLength={250}
                />
                <SectionHeader
                  title="更多规则"
                  action={advanced ? "收起" : "展开"}
                  onPress={() => A(!advanced)}
                />
                {!advanced && (
                  <Body muted>09:00–12:00、14:00–17:00 · {duration} 分钟</Body>
                )}
                {advanced && (
                  <>
                    <WorkHours shifts={shifts} onChange={H} />
                    <Field
                      label="时长（分钟）"
                      value={duration}
                      onChangeText={D}
                      keyboardType="number-pad"
                    />
                    {(worklog || entry !== "companion") && (
                      <>
                        {["面对面", "电话", "网络"].map((v) => (
                          <Choice
                            key={v}
                            label={v}
                            selected={method === v}
                            onPress={() => M(v)}
                          />
                        ))}
                        {!worklog && (
                          <Dropdown
                            label="学校谈话场景"
                            value={scene}
                            onChange={SC}
                            options={schoolOptions.scenes}
                            disabled={!schoolOptions.scenes.length}
                            helper="轮次缺走访时，会在预览中补充走访场景谈话，请核对实际工作。"
                          />
                        )}
                      </>
                    )}
                    {!worklog && entry !== "talk" && (
                      <Dropdown
                        label="学校陪伴类型"
                        value={pbType}
                        onChange={PB}
                        options={schoolOptions.companionTypes}
                        disabled={!schoolOptions.companionTypes.length}
                      />
                    )}
                  </>
                )}
              </Card>
            </>
          )}
          {step === 2 && plan && (
            <>
              <PlanPreview
                plan={plan}
                onEdit={edit}
                busy={busy}
                error={error}
              />
              {plan.state === "scanning" && (
                <Button
                  title="停止核对"
                  secondary
                  onPress={() =>
                    run(async () => {
                      await post(
                        (plan.request?.retryOf ? "/api/task" : api) +
                          "/plans/" +
                          plan.id +
                          "/cancel",
                      );
                      P(await get("/api/task/plans/" + plan.id));
                    })
                  }
                />
              )}
            </>
          )}
        </>
      </SchoolGate>
      <PeoplePicker
        visible={people}
        onClose={() => O(false)}
        onConfirm={(v) => {
          I(v);
          O(false);
        }}
        students={students}
        selected={ids}
        scope={scope}
        detail={
          worklog
            ? (s) =>
                `本学期 ${s.semesterCount} 次 · 学校列表 ${s.schoolCount} 次`
            : (s) =>
                `次数还差 ${s.remainingCount ?? "待核对"} · 轮次缺项 ${s.roundMissingCount ?? "待核对"}`
        }
        filterMissing={
          worklog
            ? (s) => !skip || s.semesterCount < Number(target)
            : (s) => !s.missingWeeks || s.missingWeeks.length > 0
        }
      />
    </Page>
  );
}
