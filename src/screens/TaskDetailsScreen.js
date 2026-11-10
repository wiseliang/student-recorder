import React, { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { get } from "../utils/api";
import {
  Page,
  Body,
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
  useEffect(() => {
    let live = true;
    get("/api/task/" + route.params.taskUuid)
      .then((t) => live && T(t))
      .catch((e) => live && E(e));
    return () => {
      live = false;
    };
  }, [route.params.taskUuid]);
  const rows = (task?.details || []).filter(
    (d) =>
      (!query || d.name?.includes(query) || d.studentId?.includes(query)) &&
      (!issues ||
        [
          "failed",
          "unconfirmed",
          "planned",
          "cancelled",
          "not_applicable",
        ].includes(d.status)),
  );
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
        <Body muted>匹配 {rows.length} 项</Body>
      </View>
      <FlatList
        data={rows}
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
