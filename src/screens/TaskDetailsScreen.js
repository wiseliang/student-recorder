import React, { useEffect, useState, useRef } from "react";
import { View, Text, FlatList } from "react-native";
import { get } from "../utils/api";
import {
  Page,
  Body,
  Button,
  Field,
  Choice,
  ErrorBox,
  Pill,
  colors,
  styles,
} from "../components/ui";
import { operationLabel } from "../utils/presentation";
export default function TaskDetailsScreen({ route }) {
  const [task, T] = useState(null),
    [error, E] = useState(null),
    [query, Q] = useState(""),
    [issues, F] = useState(false);
  const [page, P] = useState(1),
    [more, M] = useState(false),
    [total, N] = useState(0),
    [busy, B] = useState(false),
    seq = useRef(0);
  const load = async (next = 1) => {
    const ticket = ++seq.current;
    B(true);
    try {
      const r = await get("/api/task/" + route.params.taskUuid + "/details", {
        page: next,
        pageSize: 30,
        query,
        issues: issues ? "1" : "0",
      });
      if (ticket !== seq.current) return;
      T((old) => ({
        details: next === 1 ? r.items : [...(old?.details || []), ...r.items],
      }));
      P(next);
      M(r.hasMore);
      N(r.total);
      E(null);
    } catch (e) {
      if (ticket === seq.current) E(e);
    } finally {
      if (ticket === seq.current) B(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      seq.current++;
    };
  }, [route.params.taskUuid, query, issues]);
  const rows = task?.details || [];
  return (
    <Page scroll={false}>
      <View style={{ gap: 12, paddingVertical: 16 }}>
        <Field
          label="搜索记录"
          value={query}
          onChangeText={Q}
          placeholder="姓名或学号"
        />
        <Choice
          label="只看需处理的记录"
          selected={issues}
          onPress={() => F(!issues)}
        />
        <ErrorBox error={error} />
        <Body muted>
          匹配 {total} 项 · 已加载 {rows.length} 项
        </Body>
      </View>
      <FlatList
        data={rows}
        ListEmptyComponent={
          <Body muted>{busy ? "正在读取明细…" : "当前筛选没有记录"}</Body>
        }
        ListFooterComponent={
          more ? (
            <Button
              title="加载更多明细"
              loading={busy}
              onPress={() => load(page + 1)}
            />
          ) : null
        }
        keyExtractor={(d, i) => String(d.id || i)}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item: d }) => (
          <View
            style={{
              padding: 18,
              marginBottom: 10,
              borderRadius: 16,
              backgroundColor: colors.surface,
              gap: 8,
            }}
          >
            <Text style={[styles.body, { fontWeight: "500" }]}>
              {d.name || d.studentId} · 第 {d.week} 周
            </Text>
            <Pill>{operationLabel(d)}</Pill>
            <Body muted>
              {d.studentId}
              {d.recordedAt ? " · " + d.recordedAt : ""}
            </Body>
            {d.type !== "companion" && d.method && (
              <Body muted>谈话方式：{d.method}</Body>
            )}
            {d.type !== "companion" && d.durationMinutes && (
              <Body muted>时长：{d.durationMinutes} 分钟</Body>
            )}
            {d.content && <Body>内容：{d.content}</Body>}
            {d.goal && (
              <Body muted>
                {
                  {
                    count: "补足学校次数",
                    talk: "补齐本轮谈话",
                    visit: "补齐本轮走访",
                    companion: "补齐本轮陪伴",
                  }[d.goal]
                }
                {d.type === "talk"
                  ? ` · 场景：${d.scene}`
                  : d.pbType
                    ? ` · ${d.pbType}`
                    : ""}
              </Body>
            )}
            {d.reason && <Body muted>{d.reason}</Body>}
            {d.receipt?.schoolRecordId && (
              <Body muted>学校回执 {d.receipt.schoolRecordId}</Body>
            )}
          </View>
        )}
      />
    </Page>
  );
}
