import { View, Text, Pressable } from "react-native";
import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { get, cacheRead, cacheWrite } from "../utils/api";
import {
  ACTIVE,
  statusLabels,
  taskTitle,
  semesterLabel,
  dateLabel,
} from "../utils/presentation";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Field,
  Choice,
  ErrorBox,
  Pill,
  EmptyState,
  colors,
} from "../components/ui";
export default function HistoryScreen({ navigation }) {
  const [items, I] = useState([]),
    [page, P] = useState(1),
    [more, M] = useState(false),
    [search, S] = useState(""),
    [status, F] = useState(""),
    [error, E] = useState(null),
    [cached, C] = useState(false),
    [busy, B] = useState(false);
  const seq = useRef(0),
    live = useRef(true);
  const load = async (next = 1) => {
    const n = ++seq.current;
    B(true);
    E(null);
    try {
      const r = await get("/api/history", {
        page: next,
        pageSize: 20,
        search,
        status,
      });
      if (!live.current || n !== seq.current) return;
      I((old) => (next === 1 ? r.items : [...old, ...r.items]));
      P(next);
      M(r.hasMore);
      C(false);
      if (next === 1) await cacheWrite("history", r.items);
    } catch (e) {
      if (!live.current || n !== seq.current) return;
      E(e);
      if (next === 1) {
        const c = await cacheRead("history");
        if (c && live.current && n === seq.current) {
          I(c);
          C(true);
          M(false);
        }
      }
    } finally {
      if (live.current && n === seq.current) B(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      load();
      return () => {
        live.current = false;
        seq.current++;
      };
    }, [status]),
  );
  return (
    <Page>
      <Title>任务历史</Title>
      <Field label="搜索任务编号、学期或选项" value={search} onChangeText={S} />
      <Button title="搜索 / 刷新" loading={busy} onPress={() => load()} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          ["", "全部"],
          ["active", "进行中"],
          ["completed", "已完成"],
          ["partial_failed", "部分完成"],
          ["failed", "失败"],
          ["interrupted", "中断"],
          ["cancelled", "取消"],
        ].map(([v, label]) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => F(v)}
            style={{
              minHeight: 44,
              paddingHorizontal: 16,
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: status === v ? colors.primary : colors.surface,
            }}
          >
            <Text
              style={{
                color: status === v ? "#FFF" : colors.muted,
                fontSize: 14,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ErrorBox error={error} onRetry={() => load()} />
      {cached && <Body>当前显示本机缓存，状态可能已变化；联网后刷新。</Body>}
      {!items.length && !busy && !error && (
        <EmptyState
          title="还没有录入记录"
          description="完成录入后，可在这里查看结果与学校回执。"
        />
      )}
      {items.map((t) => (
        <Card key={t.taskUuid}>
          <Pill>{t.type === "worklog-talk" ? "工作日志管理" : "学情日志"}</Pill>
          <Body>{taskTitle(t)}</Body>
          <Body muted>
            {semesterLabel(t.calendar)} · {dateLabel(t.createdAt)}
          </Body>
          <Body>{statusLabels[t.status] || t.status}</Body>
          <Button
            title={ACTIVE.includes(t.status) ? "查看实时进度" : "查看结果"}
            secondary
            onPress={() =>
              navigation.navigate(
                ACTIVE.includes(t.status) ? "Progress" : "Result",
                { taskUuid: t.taskUuid },
              )
            }
          />
        </Card>
      ))}
      {more && (
        <Button
          title="加载下一页"
          loading={busy}
          onPress={() => load(page + 1)}
        />
      )}
    </Page>
  );
}
