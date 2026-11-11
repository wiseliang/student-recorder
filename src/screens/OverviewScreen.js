import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, FlatList, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  ErrorBox,
  Pill,
  IconButton,
  colors,
  styles,
  Field,
} from "../components/ui";
import Dropdown from "../components/Dropdown";
import { useSchool } from "../state/SchoolContext";
import { get, post, cacheRead, cacheWrite, currentPlan } from "../utils/api";
import { useForeground } from "../utils/useForeground";
const labels = { talk: "谈话", visit: "走访", companion: "陪伴" };
export default function OverviewScreen({ navigation, route }) {
  const { school } = useSchool(),
    foreground = useForeground();
  const [kind, K] = useState(route?.params?.kind || "academic"),
    [target, T] = useState("1"),
    [data, D] = useState(null),
    [scan, S] = useState(null),
    [error, E] = useState(null),
    [notice, N] = useState(""),
    [busy, B] = useState(false),
    [query, Q] = useState(""),
    [filter, F] = useState("all"),
    [cached, C] = useState(false),
    [detail, U] = useState(null),
    [existing, X] = useState(null);
  const viewRef = useRef(null);
  viewRef.current = { kind, target, query, filter };
  const alive = useRef(true),
    seq = useRef(0),
    kindRef = useRef(kind),
    lock = useRef(false),
    pendingRead = useRef(false);
  kindRef.current = kind;
  const options = () => ({
    targetCount: Number(target),
    query,
    filter,
    pageSize: 50,
  });
  const apply = async (r, append = false) => {
    if (!alive.current) return;
    D((old) =>
      append
        ? { ...r, students: [...(old?.students || []), ...r.students] }
        : r,
    );
    C(false);
    E(null);
    if (!query && filter === "all" && r.page === 1)
      await cacheWrite("overview." + kind, r);
  };
  const load = async (page = 1) => {
    const ticket = ++seq.current;
    B(true);
    try {
      if (page === 1) {
        const pending = await cacheRead("overviewScan." + kind);
        if (
          pending &&
          alive.current &&
          ticket === seq.current &&
          (!school.connectionId || pending.connectionId === school.connectionId)
        )
          S((old) => old || pending);
      }
      const response =
        page > 1
          ? await get("/api/overview/" + data.id, { ...options(), page })
          : (await get("/api/overview/latest", { kind, ...options() }))
              .snapshot;
      if (!alive.current || ticket !== seq.current) return;
      if (response) await apply(response, page > 1);
      else {
        D(null);
        C(false);
      }
    } catch (e) {
      if (!alive.current || ticket !== seq.current) return;
      E(e);
      if (page === 1) {
        const saved = await cacheRead("overview." + kind);
        if (
          saved &&
          (!school.connectionId ||
            saved.connectionId === school.connectionId) &&
          (!school.calendar?.startDate ||
            saved.calendar.startDate === school.calendar.startDate)
        ) {
          D(saved);
          C(true);
          if (kind === "worklog") T(String(saved.summary.targetCount));
          N(
            "当前显示上次完整统计，离线名单仅包含已缓存的前 " +
              saved.students.length +
              " 人。",
          );
        }
      }
    } finally {
      if (alive.current && ticket === seq.current) B(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      seq.current++;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      let stop = false;
      const timer = setTimeout(() => {
        if (!stop) void load();
      }, 250);
      return () => {
        stop = true;
        clearTimeout(timer);
        seq.current++;
      };
    }, [kind, target, query, filter, school.connectionId]),
  );
  const refresh = async (full = true, selectedKind = kind) => {
    if (lock.current) return;
    lock.current = true;
    B(true);
    E(null);
    try {
      const r = await post("/api/overview/scan", {
        kind: selectedKind,
        full: full === true,
      });
      const pending = {
        ...r,
        kind: selectedKind,
        connectionId: school.connectionId,
      };
      S(pending);
      await cacheWrite("overviewScan." + selectedKind, pending);
      N("正在读取新数据，当前保留上次完整统计。");
    } catch (e) {
      E(e);
      if (e.code === "SCHOOL_AUTH_REQUIRED") {
        pendingRead.current = true;
        navigation.navigate("SchoolLogin", { force: true });
      }
    } finally {
      lock.current = false;
      if (alive.current) B(false);
    }
  };
  useEffect(() => {
    if (foreground && school.hasActiveSession && pendingRead.current) {
      pendingRead.current = false;
      void refresh();
    }
  }, [foreground, school.hasActiveSession]);
  useEffect(() => {
    if (!foreground || !scan) return;
    let stopped = false,
      timer;
    const poll = async () => {
      try {
        const r = await get("/api/overview/" + scan.id, {
          targetCount: Number(viewRef.current.target),
          pageSize: 50,
        });
        if (stopped) return;
        if (r.state === "ready") {
          await cacheWrite("overview." + r.kind, r);
          if (r.kind === kindRef.current) {
            const v = viewRef.current;
            const fingerprint = JSON.stringify(v);
            const ticket = ++seq.current;
            const shown = await get("/api/overview/" + r.id, {
              targetCount: Number(v.target),
              query: v.query,
              filter: v.filter,
              pageSize: 50,
            });
            if (stopped) return;
            if (fingerprint !== JSON.stringify(viewRef.current)) {
              timer = setTimeout(poll, 0);
              return;
            }
            if (ticket !== seq.current) {
              timer = setTimeout(poll, 0);
              return;
            }
            D(shown);
            B(false);
            C(false);
            N("学校记录已更新，次数与轮次分别核对。");
          }
          await cacheWrite("overviewScan." + scan.kind, null);
          S(null);
          E(null);
          return;
        }
        S((old) => ({ ...old, progress: r.progress }));
        if (r.state !== "scanning") {
          await cacheWrite("overviewScan." + scan.kind, null);
          S(null);
          N(r.error || "读取已停止，上次完整统计仍保留。");
          return;
        }
        timer = setTimeout(poll, 1600);
      } catch (e) {
        if (!stopped) {
          E(e);
          if (
            ["OVERVIEW_NOT_FOUND", "OVERVIEW_TERM_CHANGED"].includes(e.code)
          ) {
            await cacheWrite("overviewScan." + scan.kind, null);
            S(null);
            N("读取已结束或账号学期已变化，请更新学校记录。");
            return;
          }
          timer = setTimeout(poll, 5000);
        }
      }
    };
    timer = setTimeout(poll, 400);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [scan?.id, foreground]);
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.refreshAfterTask) {
        K(route.params.kind || "academic");
        navigation.setParams({ refreshAfterTask: false });
        void refresh(false, route.params.kind || "academic");
      }
    }, [route?.params?.refreshAfterTask]),
  );
  const showDetail = async (s) => {
    B(true);
    try {
      const r = await get(
        "/api/overview/" + data.id + "/students/" + s.studentId,
        { targetCount: Number(target) },
      );
      U(r);
    } catch (e) {
      E(e);
    } finally {
      B(false);
    }
  };
  const go = (selection) =>
    navigation.navigate(
      selection.kind === "academic" ? "Record" : "WorklogTalk",
      {
        entry: selection.kind === "academic" ? "automatic" : "talk",
        overviewPrefill: selection,
      },
    );
  const fill = async (currentWeek = false) => {
    if (lock.current) return;
    lock.current = true;
    B(true);
    E(null);
    try {
      if (!school.hasActiveSession) {
        navigation.navigate("SchoolLogin", { force: true });
        return;
      }
      const selection = await post("/api/overview/" + data.id + "/selection", {
          targetCount: Number(target),
          currentWeek,
        }),
        planId = await currentPlan();
      if (planId) {
        try {
          const p = await get("/api/task/plans/" + planId);
          if (!p.usedBy && ["ready", "scanning"].includes(p.state)) {
            X(p);
            return;
          }
        } catch (e) {
          if (!["PLAN_EXPIRED", "PLAN_NOT_FOUND"].includes(e.code)) throw e;
        }
        await currentPlan(null);
      }
      go(selection);
    } catch (e) {
      E(e);
    } finally {
      lock.current = false;
      B(false);
    }
  };
  const count = data?.summary,
    academic = kind === "academic",
    cacheRows = (data?.students || []).filter(
      (s) =>
        !cached ||
        ((!query ||
          (s.name + " " + s.studentId)
            .toLowerCase()
            .includes(query.trim().toLowerCase())) &&
          (filter !== "current" ||
            s.weeks?.some((w) => w.current && !w.complete)) &&
          (filter !== "count" || (s.remainingCount ?? s.remaining ?? 0) > 0) &&
          (filter !== "round" || s.roundMissingCount > 0) &&
          (filter !== "unknown" || s.unknown) &&
          (filter !== "missing" ||
            (s.remaining ?? s.expected - s.completed) > 0 ||
            s.roundMissingCount > 0)),
    );
  const header = (
    <View style={{ gap: 16, paddingBottom: 16 }}>
      <Title>学期总览</Title>
      <Body muted>
        {data?.calendar
          ? `${data.calendar.academicYear}学年 · ${data.calendar.semester} · 当前第 ${data.calendar.week} 周`
          : "分别核对学情日志与工作日志的学校记录"}
      </Body>
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          backgroundColor: colors.tint,
          borderRadius: 14,
          gap: 4,
        }}
      >
        {[
          ["academic", "学情日志"],
          ["worklog", "工作日志"],
        ].map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: k === kind }}
            accessibilityLabel={label}
            onPress={() => {
              K(k);
              D(null);
              Q("");
              F("all");
              N("");
              E(null);
            }}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 11,
              backgroundColor: k === kind ? colors.surface : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: k === kind ? colors.primary : colors.muted,
                fontWeight: "500",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {!academic && (
        <Dropdown
          label="每人本学期目标"
          value={target}
          options={Array.from({ length: 10 }, (_, i) => ({
            value: String(i + 1),
            label: `${i + 1} 次`,
          }))}
          onChange={(label) => T(label.split(" ")[0])}
          disabled={cached || !!scan}
        />
      )}
      {count && (
        <Card
          style={{
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          }}
        >
          <Body style={{ color: "#DCEBFA" }}>
            {academic
              ? "已结束周 · 学校次数与轮次同时满足"
              : "本学期 · 工作日志自己的完整名单"}
          </Body>
          <Text style={{ fontSize: 36, color: "#FFF", fontWeight: "500" }}>
            {count.complete
              ? `${count.completed} / ${count.expected}`
              : "尚未完整核实"}{" "}
            <Text style={{ fontSize: 14 }}>
              {academic ? "人周已完成" : "人已达标"}
            </Text>
          </Text>
          {count.complete && (
            <View
              style={{
                height: 6,
                backgroundColor: "#FFFFFF44",
                borderRadius: 3,
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${count.expected ? Math.min(100, (count.completed / count.expected) * 100) : 0}%`,
                  backgroundColor: "#FFF",
                  borderRadius: 3,
                }}
              />
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 16 }}>
            {(academic
              ? [
                  ["次数缺口", count.missingCounts],
                  ["轮次缺项", count.missingRounds],
                  ["未核实周", count.unverifiedWeeks],
                ]
              : [
                  ["未达标人数", count.missingStudents],
                  ["尚需次数", count.missingCounts],
                  [
                    "待核实记录",
                    (count.futureCount || 0) + (count.invalidCount || 0),
                  ],
                ]
            ).map(([label, value]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`查看${label}明细`}
                style={{ flex: 1, minHeight: 44 }}
                onPress={() => {
                  if (label === "未核实周")
                    N(
                      data.weeks
                        .filter((w) => w.error)
                        .map((w) => `第${w.week}周：${w.error}`)
                        .join("；") || "所有周次均已核实",
                    );
                  else
                    F(
                      label === "次数缺口"
                        ? "count"
                        : label === "轮次缺项"
                          ? "round"
                          : label === "待核实记录"
                            ? "unknown"
                            : "missing",
                    );
                }}
              >
                <Text style={{ fontSize: 23, color: "#FFF" }}>{value}</Text>
                <Text style={{ fontSize: 12, color: "#DCEBFA" }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {!count.complete && (
            <Body style={{ color: "#DCEBFA" }}>
              以下次数及缺项仅针对已核实周，不能视为完整学期结果。
            </Body>
          )}
          {academic && (
            <Body style={{ color: "#DCEBFA" }}>
              学校应计 {count.requiredCount} 次，学校已计 {count.completedCount}{" "}
              次；轮次缺项按各周谈话、走访、陪伴分别核对。学校达标按学校原始字段判定，记录时间异常单独提示。
            </Body>
          )}
        </Card>
      )}
      {academic && count?.currentWeek && (
        <Card>
          <Body>本周 · 第 {count.currentWeek.week} 周</Body>
          <Body muted>
            {count.currentWeek.error
              ? "本周未核实"
              : `${count.currentWeek.completed} / ${count.currentWeek.expected} 人已满足学校要求；本周尚未结束。`}
          </Body>
          {!!count.currentWeek.warningStudents && (
            <Body style={{ color: colors.warning }}>
              其中 {count.currentWeek.warningStudents}{" "}
              人有记录时间或时长待核实；不改变学校达标状态，异常项不会自动补写。
            </Body>
          )}
          <Button
            secondary
            title="查看本周待完成学生"
            disabled={!count.complete || busy || !!scan}
            onPress={() => F("current")}
          />
        </Card>
      )}
      {data && (
        <Body muted>
          {cached ? "本机缓存 · " : data.stale ? "较早快照 · " : ""}
          {data.profile ? data.profile + " · " : ""}本次更新完成于{" "}
          {new Date(data.readCompletedAt).toLocaleString("zh-CN", {
            hour12: false,
          })}
          。录入后请更新，任务成功数不会直接加到旧快照。
        </Body>
      )}
      {!!data?.reusedWeeks?.length && (
        <Body muted>
          复用了 {data.reusedWeeks.length}{" "}
          个已核实历史周（最长6小时）；本周及变动周已重读，可完整刷新重新核对全部记录。
        </Body>
      )}
      {!!notice && <Body muted>{notice}</Body>}
      <ErrorBox error={error} onRetry={() => load()} />
      <Button
        title={
          scan ? "正在读取学校记录" : data ? "更新学校记录" : "读取学校记录"
        }
        loading={busy || !!scan}
        disabled={!!scan}
        onPress={() => refresh(false)}
      />
      {!!data?.dirtyWeeks?.length && (
        <Body muted>
          录入后第 {data.dirtyWeeks.join("、")} 周有变化，更新将优先核对这些周。
        </Body>
      )}
      {data && !scan && (
        <Button
          title="完整重读整个学期"
          secondary
          disabled={busy}
          onPress={() => refresh(true)}
        />
      )}
      {scan && (
        <>
          <Body muted>
            正在读取{scan.kind === "academic" ? "学情日志" : "工作日志"}{" "}
            {scan.progress?.processed || 0} / {scan.progress?.total || "…"}
          </Body>
          <Button
            title="停止总览读取"
            secondary
            onPress={async () => {
              try {
                await post("/api/overview/" + scan.id + "/cancel");
              } catch (e) {
                E(e);
              }
            }}
          />
        </>
      )}
      {!data && !scan && !busy && (
        <Body muted>
          读取学校记录后，可查看真实次数、轮次和缺漏；查看总览不会提交记录。
        </Body>
      )}
      {data && (
        <>
          <Field
            label="搜索学生"
            placeholder="姓名或学号"
            value={query}
            onChangeText={Q}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["all", "全部"],
              ["missing", academic ? "往周缺漏" : "未达标"],
              ...(academic
                ? [
                    ["current", "本周待完成"],
                    ["count", "次数缺口"],
                    ["round", "轮次缺项"],
                  ]
                : []),
              ["unknown", "待核实"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => F(value)}
                style={{
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  borderRadius: 11,
                  backgroundColor:
                    filter === value ? colors.primary : colors.surface,
                }}
              >
                <Text
                  style={{ color: filter === value ? "#FFF" : colors.muted }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Body muted>
            {cached
              ? `当前筛选缓存 ${cacheRows.length} 人 / 原名单 ${data.totalStudents} 人`
              : `匹配 ${data.matched} 人 · 名单共 ${data.totalStudents} 人`}
          </Body>
        </>
      )}
    </View>
  );
  return (
    <Page
      scroll={false}
      footer={
        data && (
          <>
            <Button
              title={
                academic
                  ? filter === "current"
                    ? "查看本周待完成并去补录"
                    : "查看往周缺漏并去补录"
                  : "查看未达标学生并去补录"
              }
              disabled={busy || !!scan || !count?.complete || cached}
              onPress={() => fill(filter === "current")}
            />
            <Body muted>带入范围后仍需重新读取名单、核对预览并手动确认。</Body>
          </>
        )
      }
    >
      <FlatList
        data={cacheRows}
        keyExtractor={(s) => s.studentId}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={5}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          !busy && data ? (
            <Body muted>
              当前筛选没有匹配学生；可切换往周、本周或待核实范围。
            </Body>
          ) : null
        }
        renderItem={({ item: s }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看 ${s.name} 明细`}
            onPress={() => showDetail(s)}
            style={{
              padding: 17,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderColor: colors.line,
              gap: 5,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text style={[styles.body, { fontWeight: "500" }]}>{s.name}</Text>
              <Text style={[styles.body, { fontWeight: "500" }]}>
                {s.completed} / {s.expected}
                {academic ? " 周" : " 次"}
              </Text>
            </View>
            <Body muted>{s.studentId}</Body>
            <Body style={{ color: s.unknown ? colors.warning : colors.muted }}>
              {s.unknown
                ? "部分记录待核实，可查看具体周次；异常项不会自动补写"
                : academic
                  ? `次数还差 ${s.remainingCount} · 轮次缺项 ${s.roundMissingCount}`
                  : s.remaining
                    ? `尚需 ${s.remaining} 次${s.hasContact ? "" : " · 缺联系方式"}`
                    : "已达到本学期目标"}
            </Body>
          </Pressable>
        )}
        ListFooterComponent={
          data?.hasMore && !cached ? (
            <Button
              secondary
              title="加载更多学生"
              loading={busy}
              onPress={() => load(data.page + 1)}
            />
          ) : null
        }
      />
      <Modal
        visible={!!detail}
        animationType="slide"
        onRequestClose={() => U(null)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.title}>{detail?.name || "学生明细"}</Text>
            <IconButton
              name="close"
              label="关闭学生明细"
              onPress={() => U(null)}
            />
          </View>
          <FlatList
            data={academic ? detail?.weeks || [] : detail?.records || []}
            keyExtractor={(r, i) => String(r.week || r.id || i)}
            ListHeaderComponent={
              <View style={{ paddingVertical: 16, gap: 8 }}>
                <Body muted>{detail?.studentId}</Body>
                {!academic && (
                  <>
                    <Body>
                      本学期有效 {detail?.completed} 次 / 目标{" "}
                      {detail?.expected} 次
                    </Body>
                    <Body muted>
                      学校列表累计 {detail?.schoolCount}{" "}
                      次，统计范围与本学期不同。
                    </Body>
                    {!!detail?.futureCount && (
                      <Body style={{ color: colors.warning }}>
                        有 {detail.futureCount}{" "}
                        条未来记录，不计正常完成，不直接重复补写。
                      </Body>
                    )}
                  </>
                )}
              </View>
            }
            renderItem={({ item: r }) => (
              <Card style={{ marginBottom: 12 }}>
                {academic ? (
                  <>
                    <Body>
                      第 {r.week} 周{r.current ? " · 本周进行中" : ""}
                    </Body>
                    <Body>
                      学校次数 {r.completed} / {r.required}
                      {r.countExempt ? "（学校免次数要求）" : ""}
                    </Body>
                    <Body muted>
                      本轮谈话 {r.round.talk} · 走访 {r.round.visit} · 陪伴{" "}
                      {r.round.companion}
                    </Body>
                    <Body
                      style={{
                        color: r.complete ? colors.success : colors.warning,
                      }}
                    >
                      {r.complete
                        ? "学校次数与轮次均已完成"
                        : r.roundMissing.length
                          ? "轮次缺少：" +
                            r.roundMissing.map((k) => labels[k]).join("、")
                          : "尚差 " + r.remaining + " 次"}
                    </Body>
                    {!!r.anomalies?.length && (
                      <Body style={{ color: colors.warning }}>
                        记录待核实：{r.anomalies.join("；")}
                        。学校达标与记录核验分别展示。
                      </Body>
                    )}
                    {!r.editable && (
                      <Body muted>学校日志不可编辑，需到学校核对。</Body>
                    )}
                    {r.records?.slice(0, 8).map((record) => (
                      <Body key={record.id} muted>
                        {record.type === "talk" ? "谈话" : "陪伴"} ·{" "}
                        {record.recordedAt}
                      </Body>
                    ))}
                  </>
                ) : (
                  <>
                    <Body>{r.recordedAt}</Body>
                    <Body muted>
                      {r.duration} 分钟 ·{" "}
                      {{ 1: "面对面", 2: "电话", 3: "网络" }[r.method] ||
                        "学校记录"}
                    </Body>
                    {(r.future || r.invalid) && (
                      <Body style={{ color: colors.warning }}>
                        {r.invalid
                          ? "时间或时长异常，未计入已完成"
                          : "未来时间，未计入已完成"}
                      </Body>
                    )}
                  </>
                )}
              </Card>
            )}
          />
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!existing}
        transparent
        animationType="fade"
        onRequestClose={() => X(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#12325288",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card>
            <Title>已有未完成预览</Title>
            <Body>
              先继续原预览，或保留原稿返回总览。本次不会覆盖之前的填写内容。
            </Body>
            <Button
              title="继续原预览"
              onPress={() => {
                const p = existing;
                X(null);
                navigation.navigate(
                  p.request?.recordType === "worklog-talk"
                    ? "WorklogTalk"
                    : "Record",
                  {
                    entry:
                      p.request?.recordType === "worklog-talk"
                        ? "talk"
                        : p.request?.entry || p.request?.recordType || "talk",
                    overviewPrefill: null,
                  },
                );
              }}
            />
            <Button
              title="保留原稿并返回总览"
              secondary
              onPress={() => X(null)}
            />
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
