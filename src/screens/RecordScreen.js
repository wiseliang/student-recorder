import { useForeground } from "../utils/useForeground";
import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import SchoolLogin from "../components/SchoolLogin";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Choice,
  Field,
  ErrorBox,
} from "../components/ui";
import { get, post, currentPlan } from "../utils/api";
import { bounds, formatActivity, validSchedule } from "../utils/calendar";
import { operationLabels } from "../utils/presentation";
export default function RecordScreen({ route, navigation }) {
  const [calendar, K] = useState(null),
    [type, T] = useState(route.params?.type || "talk"),
    [mode, M] = useState(route.params?.mode || "record"),
    [weeks, W] = useState([]),
    [students, U] = useState([]),
    [selected, S] = useState([]),
    [search, Q] = useState(""),
    [only, O] = useState(false),
    [schedule, D] = useState({}),
    [picker, J] = useState(null),
    [content, C] = useState(""),
    [duration, N] = useState("30"),
    [method, F] = useState("面对面"),
    [scene, G] = useState("走访寝室"),
    [pbType, H] = useState("共同上课"),
    [plan, P] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [rosterWeek, V] = useState(null);
  const foreground = useForeground();
  const alive = useRef(true),
    sequence = useRef(0),
    pending = useRef(false),
    abort = useRef(null);
  const run = async (fn) => {
    if (pending.current) return;
    pending.current = true;
    B(true);
    E(null);
    try {
      await fn();
    } catch (e) {
      if (alive.current) E(e);
    } finally {
      pending.current = false;
      if (alive.current) B(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    (route.params?.retryTaskUuid ? Promise.resolve(null) : currentPlan())
      .then((id) => id && get("/api/task/plans/" + id))
      .then((p) => {
        if (p && alive.current) P(p);
      })
      .catch((e) => alive.current && E(e));
    return () => {
      alive.current = false;
      sequence.current++;
      abort.current?.abort();
    };
  }, []);
  const ready = async (c) => {
    const next = c || (await get("/api/auth/academic-calendar"));
    if (!alive.current) return;
    if (!next.verified) throw Error("学校学期尚未核验");
    if (calendar && calendar.startDate !== next.startDate) {
      W([]);
      U([]);
      S([]);
      D({});
      V(null);
    }
    K(next);
    if (!weeks.length)
      W([Math.min(route.params?.week || next.week, next.week)]);
    if (route.params?.retryTaskUuid) {
      const p = await post(
        "/api/task/" + route.params.retryTaskUuid + "/retry-plan",
      );
      if (alive.current) {
        P(p);
        await currentPlan(p.id);
      }
    }
  };
  const load = async () => {
    if (!weeks.length) throw Error("请先选择周次");
    const version = ++sequence.current,
      week = Math.min(...weeks);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const res = await get(
      "/api/auth/student-list",
      { week },
      { signal: controller.signal },
    );
    if (!alive.current || version !== sequence.current) return;
    if (res.week !== week || res.calendarStartDate !== calendar.startDate)
      throw Error("名单学期或周次已变化，请重新加载");
    U(res.students);
    V(week);
    S((old) =>
      old.filter((id) => res.students.some((s) => s.studentId === id)),
    );
  };
  const toggleWeek = (w) => {
    sequence.current++;
    abort.current?.abort();
    W((old) =>
      old.includes(w)
        ? old.filter((x) => x !== w)
        : [...old, w].sort((a, b) => a - b),
    );
    V(null);
    P(null);
  };
  const preview = async () => {
    if (
      !calendar ||
      !weeks.length ||
      !selected.length ||
      rosterWeek !== Math.min(...weeks)
    )
      throw Error("请选择周次，重新加载名单并选择学生");
    if (weeks.some((w) => !validSchedule(schedule[w], calendar, w)))
      throw Error("请为每一周填写该周内已实际发生的时间（北京时间）");
    if (!content.trim()) throw Error("请填写实际工作内容");
    const r = await post("/api/task/preview", {
      recordType: type,
      mode,
      weeks,
      studentIds: selected,
      schedule,
      content,
      calendarStartDate: calendar.startDate,
      durationMinutes: Number(duration),
      method,
      scene,
      pbType,
    });
    await currentPlan(r.planId);
    if (alive.current)
      P({
        id: r.planId,
        state: "scanning",
        processed: 0,
        total: weeks.length * selected.length,
      });
  };
  useEffect(() => {
    if (plan?.state !== "scanning" || !foreground) return;
    let stopped = false,
      timer,
      controller = new AbortController();
    const poll = async () => {
      try {
        const p = await get("/api/task/plans/" + plan.id, undefined, {
          signal: controller.signal,
        });
        if (stopped) return;
        P(p);
        E(null);
        if (p.state === "scanning") timer = setTimeout(poll, 1800);
      } catch (e) {
        if (!stopped) E(e);
      }
    };
    timer = setTimeout(poll, 800);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [plan?.id, plan?.state, foreground]);
  const visible = students.filter(
    (s) =>
      (!only || selected.includes(s.studentId)) &&
      (!search || s.name?.includes(search) || s.studentId?.includes(search)),
  );
  const start = () =>
    run(async () => {
      const r = await post("/api/task/create", {
        planId: plan.id,
        requestId: plan.id,
      });
      await currentPlan(null);
      navigation.replace("Progress", { taskUuid: r.taskUuid });
    });
  return (
    <Page>
      <Title>
        {mode === "missing" ? "核对缺失，再补录" : "录入实际工作记录"}
      </Title>
      <ErrorBox
        error={error}
        onRetry={() =>
          run(async () => {
            if (plan) P(await get("/api/task/plans/" + plan.id));
            else if (calendar) await load();
          })
        }
      />
      <SchoolLogin onReady={ready} />
      {calendar && (
        <>
          <Card>
            <Body>
              {calendar.academicYear}学年 · {calendar.semester} · 学校当前第
              {calendar.week}周
            </Body>
            <Body muted>
              基准 {calendar.startDate}；每条记录按所选周次在学校网页内复核。
            </Body>
            <Choice
              label="谈话"
              selected={type === "talk"}
              onPress={() => {
                T("talk");
                P(null);
              }}
            />
            <Choice
              label="陪伴"
              selected={type === "companion"}
              onPress={() => {
                T("companion");
                P(null);
              }}
            />
            <Choice
              label="仅补该类型在该周完全缺失的记录"
              selected={mode === "missing"}
              onPress={() => {
                M(mode === "missing" ? "record" : "missing");
                P(null);
              }}
            />
            <Body muted>
              学校其他类型要求需另行核对，此处不会自动推断走访或凑足次数。
            </Body>
          </Card>
          {!plan && (
            <>
              <Card>
                <Body>1 · 选择周次</Body>
                {calendar.weeks.map((w) => (
                  <Choice
                    key={w.week}
                    label={"第" + w.week + "周 · " + w.range}
                    selected={weeks.includes(w.week)}
                    onPress={() => toggleWeek(w.week)}
                  />
                ))}
                <Body muted>
                  已选 {weeks.length}{" "}
                  周；切换后需重新核对名单，仍在名单中的已选学生会保留。
                </Body>
              </Card>
              <Card>
                <Body>
                  2 · 选择学生（已选 {selected.length}/{students.length}）
                </Body>
                <Button
                  title={busy ? "加载中" : "加载 / 重新核对名单"}
                  loading={busy}
                  disabled={!weeks.length}
                  onPress={() => run(load)}
                />
                {rosterWeek && (
                  <Body muted>
                    基准名单为第{rosterWeek}周；多周差异将在预览中逐人检查。
                  </Body>
                )}
                <Field
                  label="按姓名或学号搜索"
                  value={search}
                  onChangeText={Q}
                />
                <Choice
                  label="只看已选学生"
                  selected={only}
                  onPress={() => O(!only)}
                />
                <Button
                  title="选择当前搜索结果"
                  secondary
                  disabled={!rosterWeek}
                  onPress={() =>
                    S((old) => [
                      ...new Set([...old, ...visible.map((s) => s.studentId)]),
                    ])
                  }
                />
                <Button title="清空选择" secondary onPress={() => S([])} />
                {visible.map((s) => (
                  <Choice
                    key={s.studentId}
                    label={s.name + " · " + s.studentId}
                    selected={selected.includes(s.studentId)}
                    onPress={() =>
                      S((old) =>
                        old.includes(s.studentId)
                          ? old.filter((id) => id !== s.studentId)
                          : [...old, s.studentId],
                      )
                    }
                  />
                ))}
                {!visible.length && <Body muted>当前没有匹配学生。</Body>}
              </Card>
              <Card>
                <Body>3 · 实际发生时间（北京时间）</Body>
                {weeks.map((w) => (
                  <View key={w} style={{ gap: 8 }}>
                    <Body>
                      第{w}周：{schedule[w] || "尚未填写"}
                    </Body>
                    <Button
                      title={"选择第" + w + "周日期与时间"}
                      secondary
                      onPress={() =>
                        J({
                          week: w,
                          mode: "date",
                          value: schedule[w]
                            ? new Date(schedule[w].replace(" ", "T") + "+08:00")
                            : bounds(calendar, w).initial,
                        })
                      }
                    />
                  </View>
                ))}
                <Body muted>
                  时间必须在对应周内且不能晚于现在。批量共用时间仅适用于实际共同发生的工作。
                </Body>
                {picker && (
                  <DateTimePicker
                    key={picker.mode}
                    value={picker.value}
                    mode={picker.mode}
                    is24Hour
                    timeZoneName="Asia/Shanghai"
                    minimumDate={bounds(calendar, picker.week).min}
                    maximumDate={bounds(calendar, picker.week).max}
                    onChange={(e, date) => {
                      if (e.type === "dismissed" || !date) {
                        J(null);
                        return;
                      }
                      if (picker.mode === "date")
                        J({ ...picker, mode: "time", value: date });
                      else {
                        D((old) => ({
                          ...old,
                          [picker.week]: formatActivity(date),
                        }));
                        J(null);
                      }
                    }}
                  />
                )}
                <Field
                  label="实际工作内容（最多 250 字）"
                  multiline
                  maxLength={250}
                  value={content}
                  onChangeText={C}
                />
                {type === "talk" ? (
                  <>
                    <Field
                      label="谈话时长（分钟）"
                      value={duration}
                      onChangeText={N}
                      keyboardType="number-pad"
                    />
                    {["面对面", "电话", "网络"].map((v) => (
                      <Choice
                        key={v}
                        label={v}
                        selected={method === v}
                        onPress={() => F(v)}
                      />
                    ))}
                    {[
                      "其他",
                      "走访寝室",
                      "走访自习室",
                      "走访课堂",
                      "走访班级",
                      "走访团党支部",
                      "走访实验室",
                      "陪伴运动",
                      "陪伴进餐",
                      "陪伴自习",
                      "陪伴上课",
                    ].map((value) => (
                      <Choice
                        key={value}
                        label={value}
                        selected={scene === value}
                        onPress={() => G(value)}
                      />
                    ))}
                    <Field
                      label="谈话场景（与学校选项一致）"
                      value={scene}
                      onChangeText={G}
                    />
                  </>
                ) : (
                  <>
                    <Body>常用陪伴类型</Body>
                    {["共同上课", "共同进餐", "共上自习", "共同运动"].map(
                      (value) => (
                        <Choice
                          key={value}
                          label={value}
                          selected={pbType === value}
                          onPress={() => H(value)}
                        />
                      ),
                    )}
                    <Field
                      label="陪伴类型（与学校选项一致）"
                      value={pbType}
                      onChangeText={H}
                    />
                  </>
                )}
                <Button
                  title="检查已有记录，生成预览"
                  loading={busy}
                  onPress={() => run(preview)}
                />
              </Card>
            </>
          )}
        </>
      )}
      {plan && (
        <Card>
          <Body>
            检查预览 · {plan.processed || 0}/{plan.total || 0}
          </Body>
          <Body>
            {{
              scanning: "正在逐项检查，尚未录入",
              ready: "检查完成，请核对后提交",
              cancelled: "检查已取消",
              failed: "检查失败",
              interrupted: "检查中断，请重新检查",
            }[plan.state] || plan.state}
          </Body>
          {plan.error && <Body>{plan.error}</Body>}
          {plan.request && (
            <>
              <Body>
                类型：{plan.request.recordType === "talk" ? "谈话" : "陪伴"}；第
                {plan.request.weeks.join("、")}周
              </Body>
              <Body>内容：{plan.request.content}</Body>
            </>
          )}
          {plan.summary && (
            <Body>
              待新增 {plan.summary.planned || 0} · 跳过{" "}
              {plan.summary.skipped || 0} · 不适用{" "}
              {plan.summary.not_applicable || 0} · 待核查{" "}
              {plan.summary.unconfirmed || 0}
            </Body>
          )}
          {plan.operations?.map((o, i) => (
            <View
              key={o.studentId + "-" + o.week + "-" + i}
              style={{ gap: 4, paddingVertical: 8 }}
            >
              <Body>
                {o.studentName} · {o.studentId} · 第{o.week}周
              </Body>
              <Body muted>
                {operationLabels[o.status]} · {o.payload.recordedAt}
                {o.reason ? " · " + o.reason : ""}
              </Body>
            </View>
          ))}
          {plan.usedBy ? (
            <Button
              title="查看已提交任务"
              onPress={() =>
                navigation.navigate("Progress", { taskUuid: plan.usedBy })
              }
            />
          ) : (
            plan.state === "ready" && (
              <Button
                title={"确认录入 " + (plan.summary?.planned || 0) + " 项"}
                disabled={!calendar || !!plan.summary?.unconfirmed}
                loading={busy}
                onPress={start}
              />
            )
          )}
          <Button
            title={
              plan.state === "scanning" ? "取消检查" : "关闭预览，重新选择"
            }
            secondary
            loading={busy}
            onPress={() =>
              run(async () => {
                if (plan.state === "scanning") {
                  await post("/api/task/plans/" + plan.id + "/cancel");
                  P(await get("/api/task/plans/" + plan.id));
                } else {
                  await currentPlan(null);
                  P(null);
                }
              })
            }
          />
          {plan.state === "scanning" && (
            <Body muted>
              取消会在本次只读检查结束后生效，不会提交学校记录。
            </Body>
          )}
        </Card>
      )}
    </Page>
  );
}
