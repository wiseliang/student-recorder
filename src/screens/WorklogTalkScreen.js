import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Choice,
  Field,
  ErrorBox,
  MetricRow,
  styles,
  colors,
} from "../components/ui";
import SchoolLogin from "../components/SchoolLogin";
import { get, post, currentPlan, cacheRead, cacheWrite } from "../utils/api";
import { formatActivity } from "../utils/calendar";
import { operationLabels, semesterLabel } from "../utils/presentation";
import { useForeground } from "../utils/useForeground";
export default function WorklogTalkScreen({ route, navigation }) {
  const [calendar, K] = useState(null),
    [snapshot, Z] = useState(null),
    [ids, I] = useState([]),
    [query, Q] = useState(""),
    [onlyMissing, OM] = useState(false),
    [studentLimit, SL] = useState(50),
    [target, T] = useState("1"),
    [skip, S] = useState(true),
    [fromDate, F] = useState(""),
    [toDate, TD] = useState(""),
    [amStart, AS] = useState("09:00"),
    [amEnd, AE] = useState("12:00"),
    [pmStart, PS] = useState("14:00"),
    [pmEnd, PE] = useState("17:00"),
    [excluded, X] = useState(""),
    [duration, D] = useState("10"),
    [method, M] = useState("面对面"),
    [content, C] = useState(""),
    [plan, P] = useState(null),
    [edits, ED] = useState({}),
    [confirmed, CF] = useState(false),
    [planQuery, PQ] = useState(""),
    [planLimit, PL] = useState(30),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [retryLoaded, RL] = useState(false);
  const alive = useRef(true),
    flight = useRef(false),
    latestSnapshotId = useRef(null),
    foreground = useForeground();
  const applySnapshot = (s) => {
    Z(s);
    if (s.state === "ready" && latestSnapshotId.current !== s.id) {
      latestSnapshotId.current = s.id;
      I(s.students.map((x) => x.studentId));
      K(s.calendar);
      F(s.calendar.startDate);
      TD(formatActivity(new Date(s.checkedAt)).slice(0, 10));
      SL(50);
    }
  };
  const applyPlan = (p) => {
    P(p);
    CF(false);
    ED({});
    PL(30);
    PQ("");
  };
  const run = async (fn) => {
    if (flight.current) return;
    flight.current = true;
    B(true);
    E(null);
    try {
      await fn();
    } catch (e) {
      if (alive.current && e.code !== "ABORTED") E(e);
    } finally {
      flight.current = false;
      if (alive.current) B(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const [id, scanId] = await Promise.all([
          currentPlan(),
          cacheRead("worklogScanId"),
        ]);
        if (id && !route.params?.retryTaskUuid) {
          const p = await get("/api/task/plans/" + id);
          if (alive.current && p.request?.recordType === "worklog-talk")
            applyPlan(p);
        }
        if (scanId) {
          const s = await get("/api/worklog/scans/" + scanId);
          if (alive.current) applySnapshot(s);
        }
      } catch (e) {
        if (alive.current) E(e);
      }
    })();
    return () => {
      alive.current = false;
    };
  }, []);
  const ready = async (c) => {
    const value = c || (await get("/api/auth/academic-calendar"));
    if (!alive.current) return;
    K(value);
    if (!fromDate) F(value.startDate);
    if (!toDate) TD(formatActivity(new Date()).slice(0, 10));
    if (route.params?.retryTaskUuid && !retryLoaded) {
      const p = await post(
        "/api/task/" + route.params.retryTaskUuid + "/retry-plan",
      );
      if (alive.current) {
        applyPlan(p);
        RL(true);
        await currentPlan(p.id);
      }
    }
  };
  const load = () =>
    run(async () => {
      const r = await post("/api/worklog/scan");
      await cacheWrite("worklogScanId", r.snapshotId);
      if (alive.current)
        Z({
          id: r.snapshotId,
          state: "scanning",
          progress: { processed: 0, total: 0 },
          students: [],
        });
    });
  useEffect(() => {
    if (snapshot?.state !== "scanning" || !foreground) return;
    let cancelled = false,
      timer;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const s = await get("/api/worklog/scans/" + snapshot.id, undefined, {
          signal: controller.signal,
        });
        if (cancelled) return;
        applySnapshot(s);
        if (s.state === "scanning") timer = setTimeout(poll, 1800);
      } catch (e) {
        if (!cancelled) E(e);
      }
    };
    timer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [snapshot?.id, snapshot?.state, foreground]);
  const students = snapshot?.students || [],
    selected = students.filter((s) => ids.includes(s.studentId)),
    eligible = selected.filter(
      (s) => !skip || s.semesterCount < Number(target),
    ),
    visible = students.filter(
      (s) =>
        (!onlyMissing || s.semesterCount < Number(target)) &&
        (!query ||
          s.name.includes(query) ||
          s.studentId.includes(query) ||
          s.major.includes(query)),
    ),
    filteredOps = (plan?.operations || [])
      .map((op, index) => ({ op, index }))
      .filter(
        ({ op }) =>
          !planQuery ||
          op.studentId.includes(planQuery) ||
          op.studentName.includes(planQuery),
      );
  const preview = () =>
    run(async () => {
      if (snapshot?.state !== "ready") throw Error("请先读取本学期名单和次数");
      const p = await post("/api/worklog/preview", {
        snapshotId: snapshot.id,
        studentIds: ids,
        targetCount: Number(target),
        skipRecorded: skip,
        fromDate,
        toDate,
        shifts: [
          [amStart, amEnd],
          [pmStart, pmEnd],
        ],
        excludeDates: excluded.split(/[,，\s]+/).filter(Boolean),
        durationMinutes: Number(duration),
        method,
        content,
      });
      await currentPlan(p.id);
      if (alive.current) applyPlan(p);
    });
  const change = (index, key, value) => {
    ED((old) => ({ ...old, [index]: { ...old[index], [key]: value } }));
    CF(false);
  };
  const saveChanges = () =>
    run(async () => {
      const p = await post("/api/worklog/plans/" + plan.id + "/review", {
        revision: plan.revision,
        changes: Object.entries(edits).map(([index, fields]) => ({
          operationIndex: Number(index),
          recordedAt:
            fields.recordedAt ?? plan.operations[index].payload.recordedAt,
          ...(fields.content !== undefined ? { content: fields.content } : {}),
        })),
      });
      if (alive.current) applyPlan(p);
    });
  const start = () =>
    run(async () => {
      const r = await post("/api/task/create", {
        planId: plan.id,
        requestId: plan.id,
        revision: plan.revision,
        confirmedActual: confirmed,
      });
      await currentPlan(null);
      if (alive.current)
        navigation.replace("Progress", { taskUuid: r.taskUuid });
    });
  return (
    <Page>
      <Title>工作日志 · 学期谈话</Title>
      <Body>
        从“工作日志管理”的学生谈话表单录入，与按周的学情日志分别操作。所带名单默认全选。
      </Body>
      <ErrorBox
        error={error}
        onRetry={() =>
          run(async () => {
            if (snapshot?.id)
              applySnapshot(await get("/api/worklog/scans/" + snapshot.id));
            else if (plan) applyPlan(await get("/api/task/plans/" + plan.id));
          })
        }
      />
      {error?.taskUuid && (
        <Button
          title="查看当前任务"
          secondary
          onPress={() =>
            navigation.navigate("Progress", { taskUuid: error.taskUuid })
          }
        />
      )}
      <SchoolLogin onReady={ready} />
      {!plan && (
        <>
          <Card>
            <Body>1 · 读取本学期工作日志与完整所带名单</Body>
            {calendar && (
              <Body muted>
                {semesterLabel(calendar)} · 第{calendar.week}周 · 基准{" "}
                {calendar.startDate}
              </Body>
            )}
            <Button
              title="读取 / 刷新名单与谈话次数"
              loading={busy}
              disabled={!calendar || snapshot?.state === "scanning"}
              onPress={load}
            />
            {snapshot?.state === "scanning" && (
              <>
                <Body>
                  正在读取 {snapshot.progress?.processed || 0}/
                  {snapshot.progress?.total || "…"} 周，只读检查，不新增谈话。
                </Body>
                <Button
                  title="取消读取"
                  secondary
                  loading={busy}
                  onPress={() =>
                    run(async () => {
                      await post(
                        "/api/worklog/scans/" + snapshot.id + "/cancel",
                      );
                      Z(await get("/api/worklog/scans/" + snapshot.id));
                    })
                  }
                />
                <Body muted>
                  离开页面后读取可继续，从此入口能恢复；切到后台时暂停页面轮询。
                </Body>
              </>
            )}
            {snapshot?.error && <Body>{snapshot.error}</Body>}
            {snapshot?.state === "ready" && (
              <>
                <MetricRow
                  values={[
                    ["所带学生", students.length],
                    ["已选", selected.length],
                    ["未达标", eligible.length],
                    ["将跳过", selected.length - eligible.length],
                  ]}
                />
                <Body muted>
                  次数核验：{formatActivity(new Date(snapshot.checkedAt))}
                  （北京时间）
                </Body>
                {!!snapshot.existingDenseWindows && (
                  <Body>
                    已有 {snapshot.existingDenseWindows}{" "}
                    处密集时间窗口；新安排避开这些时段，不修改已有记录。
                  </Body>
                )}
                {!!snapshot.futureRecords && (
                  <Body>
                    学校已有 {snapshot.futureRecords}{" "}
                    条尚未结束或未来记录，已单独识别，不计为已完成；本流程不提前新增未来记录。
                  </Body>
                )}
              </>
            )}
          </Card>
          {snapshot?.state === "ready" && (
            <>
              <Card>
                <Body>2 · 选择学生与跳过规则</Body>
                <Choice
                  label="默认跳过本学期已达到目标次数的学生"
                  selected={skip}
                  onPress={() => S(!skip)}
                />
                <Field
                  label={
                    skip
                      ? "本学期每人目标次数（1–10）"
                      : "每人本次新增次数（1–10）"
                  }
                  keyboardType="number-pad"
                  value={target}
                  onChangeText={T}
                />
                <Field
                  label="搜索姓名、学号或专业"
                  value={query}
                  onChangeText={(v) => {
                    Q(v);
                    SL(50);
                  }}
                />
                <Choice
                  label="只看本学期未达标学生"
                  selected={onlyMissing}
                  onPress={() => {
                    OM(!onlyMissing);
                    SL(50);
                  }}
                />
                <Button
                  title="全选全部所带学生"
                  secondary
                  onPress={() => I(students.map((s) => s.studentId))}
                />
                <Button title="取消全选" secondary onPress={() => I([])} />
                <Body muted>
                  已选 {ids.length} 人，匹配 {visible.length}{" "}
                  人。学校列表次数与本学期工作日志次数分别展示；跳过以本学期已完成记录为准。
                </Body>
                {visible.slice(0, studentLimit).map((s) => (
                  <Choice
                    key={s.studentId}
                    label={s.name + " · " + s.studentId}
                    detail={
                      "本学期 " +
                      s.semesterCount +
                      " 次 · 学校列表 " +
                      s.schoolCount +
                      " 次" +
                      (skip && s.semesterCount >= Number(target)
                        ? " · 已达标，将跳过"
                        : "") +
                      (!s.hasContact ? " · 缺少联系方式，需先在学校补全" : "")
                    }
                    selected={ids.includes(s.studentId)}
                    onPress={() =>
                      I((old) =>
                        old.includes(s.studentId)
                          ? old.filter((id) => id !== s.studentId)
                          : [...old, s.studentId],
                      )
                    }
                  />
                ))}
                {visible.length > studentLimit && (
                  <Button
                    title="继续显示 50 位学生"
                    secondary
                    onPress={() => SL((n) => n + 50)}
                  />
                )}
              </Card>
              <Card>
                <Body>3 · 生成待核对的均匀时间建议</Body>
                <Body muted>
                  只使用本学期已过去的周一至周五；默认
                  09:00–12:00、14:00–17:00。开始到结束均须已过去。结合已有记录，任意滚动
                  10 分钟内最多 2 条谈话，不按整点分桶。
                </Body>
                <Field
                  label="起始日期 YYYY-MM-DD"
                  value={fromDate}
                  onChangeText={F}
                />
                <Field
                  label="截止日期 YYYY-MM-DD（不晚于今天）"
                  value={toDate}
                  onChangeText={TD}
                />
                <Field
                  label="上午开始 HH:mm"
                  value={amStart}
                  onChangeText={AS}
                />
                <Field label="上午结束 HH:mm" value={amEnd} onChangeText={AE} />
                <Field
                  label="下午开始 HH:mm"
                  value={pmStart}
                  onChangeText={PS}
                />
                <Field label="下午结束 HH:mm" value={pmEnd} onChangeText={PE} />
                <Field
                  label="排除日期（节假日或不在岗日期，逗号分隔）"
                  value={excluded}
                  onChangeText={X}
                  multiline
                />
                <Field
                  label="实际谈话时长（分钟，默认 10）"
                  value={duration}
                  onChangeText={D}
                  keyboardType="number-pad"
                />
                {["面对面", "电话", "网络"].map((v) => (
                  <Choice
                    key={v}
                    label={v}
                    selected={method === v}
                    onPress={() => M(v)}
                  />
                ))}
                <Field
                  label="实际谈话内容（可在预览中逐人修改）"
                  value={content}
                  onChangeText={C}
                  multiline
                  maxLength={250}
                />
                <Body>
                  建议时间不是实际谈话证明。请按真实记录逐项核对或修改后再提交；没有合适过去时段时会列为未安排，不会占用未来日期。
                </Body>
                <Button
                  title="生成均匀安排与跳过预览"
                  disabled={!ids.length || !content.trim()}
                  loading={busy}
                  onPress={preview}
                />
              </Card>
            </>
          )}
        </>
      )}
      {plan && (
        <>
          <Card>
            <Body>
              {plan.usedBy
                ? "预览已提交，请查看任务结果"
                : "4 · 核对预览，学校尚未新增记录"}
            </Body>
            <Body>{semesterLabel(plan.calendar)}</Body>
            <MetricRow
              values={[
                ["待新增", plan.summary?.planned || 0],
                ["跳过", plan.summary?.skipped || 0],
                ["未安排", plan.summary?.not_applicable || 0],
              ]}
            />
            <Body muted>
              按可用的已过去工作日均匀分布，考虑原有记录；提交时会重新读取次数、编辑状态和密度。
            </Body>
            <View style={{ gap: 8 }}>
              {plan.distribution
                ?.filter((w) => w.existing || w.planned)
                .map((w) => (
                  <View key={w.week} style={{ gap: 4 }}>
                    <Body muted>
                      第{w.week}周 · 原有 {w.existing} · 本次 {w.planned}
                    </Body>
                    <View
                      style={{
                        height: 6,
                        width:
                          Math.min(
                            100,
                            Math.max(
                              2,
                              ((w.existing + w.planned) /
                                Math.max(
                                  ...plan.distribution.map(
                                    (r) => r.existing + r.planned,
                                  ),
                                  1,
                                )) *
                                100,
                            ),
                          ) + "%",
                        backgroundColor: colors.primary,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                ))}
            </View>
            <Field
              label="按姓名或学号筛选预览"
              value={planQuery}
              onChangeText={(v) => {
                PQ(v);
                PL(30);
              }}
            />
            {plan.usedBy ? (
              <Button
                title="查看已提交任务"
                onPress={() =>
                  navigation.navigate("Progress", { taskUuid: plan.usedBy })
                }
              />
            ) : (
              <Body muted>
                同一预览重复提交只返回同一任务。逐条保存后取得学校回执才显示成功。
              </Body>
            )}
          </Card>
          {filteredOps.slice(0, planLimit).map(({ op, index }) => (
            <Card key={index}>
              <Body>
                {op.studentName} · {op.studentId} · 第{op.week}周
                {op.occurrence > 1 ? " · 第 " + op.occurrence + " 条" : ""}
              </Body>
              <Body>{operationLabels[op.status]}</Body>
              {op.reason && <Body muted>{op.reason}</Body>}
              {op.status === "planned" ? (
                <>
                  <Field
                    label="实际谈话时间（北京时间，秒须为 00）"
                    value={edits[index]?.recordedAt ?? op.payload.recordedAt}
                    onChangeText={(value) => change(index, "recordedAt", value)}
                  />
                  <Body muted>
                    {op.payload.durationMinutes} 分钟 · {op.payload.method}
                  </Body>
                  <Field
                    label="实际内容"
                    multiline
                    maxLength={250}
                    value={edits[index]?.content ?? op.payload.content}
                    onChangeText={(value) => change(index, "content", value)}
                  />
                </>
              ) : (
                op.payload.recordedAt && (
                  <Body muted>{op.payload.recordedAt}</Body>
                )
              )}
            </Card>
          ))}
          {filteredOps.length > planLimit && (
            <Button
              title="继续显示 30 条预览"
              secondary
              onPress={() => PL((n) => n + 30)}
            />
          )}
          <Card>
            {Object.keys(edits).length > 0 && (
              <Button
                title="保存修改并重新校验时间与密度"
                loading={busy}
                onPress={saveChanges}
              />
            )}
            <Choice
              label="我已逐项核对，并确认人员、时间、时长及内容与实际完成的谈话一致"
              selected={confirmed}
              onPress={() => CF(!confirmed)}
            />
            <Button
              title={
                "确认录入 " + (plan.summary?.planned || 0) + " 条工作日志谈话"
              }
              loading={busy}
              disabled={
                !confirmed ||
                !!Object.keys(edits).length ||
                !calendar ||
                !!plan.usedBy
              }
              onPress={start}
            />
            <Button
              title="返回名单与规则，重新安排"
              secondary
              loading={busy}
              onPress={() =>
                run(async () => {
                  await currentPlan(null);
                  P(null);
                  CF(false);
                  ED({});
                })
              }
            />
          </Card>
        </>
      )}
    </Page>
  );
}
