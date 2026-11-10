import React, { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Icon,
  Pill,
  RowLink,
  SectionHeader,
  colors,
  styles,
  ErrorBox,
} from "../components/ui";
import { useSchool, openSchool } from "../state/SchoolContext";
import { get, currentPlan } from "../utils/api";
import { statusLabel, taskTitle } from "../utils/presentation";
export default function HomeScreen({ navigation }) {
  const { school, refresh } = useSchool(),
    [active, A] = useState(null),
    [saved, S] = useState(null),
    [error, E] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([get("/api/task/active"), currentPlan()])
        .then(([r, p]) => {
          if (alive) {
            A(r.task);
            S(p);
            E(null);
          }
        })
        .catch((e) => alive && E(e));
      return () => {
        alive = false;
      };
    }, []),
  );
  const enter = (screen, params) =>
    school.hasActiveSession
      ? navigation.navigate(screen, params)
      : openSchool(navigation, { screen, params });
  return (
    <Page>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ gap: 5 }}>
          <Body muted>学工录入助手</Body>
          <Title>工作台</Title>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            school.hasActiveSession ? "查看学校连接" : "连接学校账号"
          }
          onPress={() =>
            school.hasActiveSession
              ? navigation.getParent()?.navigate("SettingsTab")
              : openSchool(navigation)
          }
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Pill tone={school.hasActiveSession ? "success" : "neutral"}>
            {school.hasActiveSession ? "学校已连接" : "未连接学校"}
          </Pill>
        </Pressable>
      </View>
      <ErrorBox error={error} />
      <View
        style={{
          backgroundColor: colors.primary,
          padding: 24,
          borderRadius: 24,
          gap: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, color: "#D3E8E1" }}>本周校历</Text>
          <Icon name="calendar-outline" color="#CBE4DC" size={23} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text
            style={{
              fontSize: 42,
              fontWeight: "500",
              color: "#FFF",
              letterSpacing: -1.3,
            }}
          >
            {school.calendar
              ? "第 " + school.calendar.week + " 周"
              : "学期周次"}
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: "#D3E8E1", lineHeight: 22 }}>
          {school.calendar
            ? `${school.calendar.academicYear}学年 · ${school.calendar.semester} · ${school.calendar.weekRange}`
            : "连接学校后自动同步当前学期"}
        </Text>
      </View>
      {active && (
        <Card style={{ borderColor: "#BFD8CD" }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Body>{taskTitle(active)}</Body>
            <Pill tone="warning">{statusLabel(active.status)}</Pill>
          </View>
          <Body muted>
            {active.progress?.processed || 0} / {active.total} 项已处理
          </Body>
          <Button
            title="继续查看任务"
            secondary
            icon="arrow-forward-outline"
            onPress={() =>
              navigation.navigate("Progress", { taskUuid: active.taskUuid })
            }
          />
        </Card>
      )}
      <View style={{ gap: 12 }}>
        <SectionHeader title="学情日志" />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.tint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="sparkles-outline" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.heading}>一键录入</Text>
              <Body muted>按周交替，自动查漏补缺</Body>
            </View>
          </View>
          <Body muted>
            第 1 周陪伴、第 2 周谈话，依次交替。已有对应记录会跳过。
          </Body>
          <Button
            title="开始一键录入"
            icon="arrow-forward-outline"
            disabled={!!active}
            onPress={() => enter("Record", { entry: "automatic" })}
          />
          <View style={{ flexDirection: "row", gap: 12, paddingTop: 4 }}>
            {[
              ["companion", "陪伴录入", "people-outline"],
              ["talk", "谈话录入", "chatbubble-ellipses-outline"],
            ].map(([entry, title, icon]) => (
              <Pressable
                key={entry}
                accessibilityRole="button"
                accessibilityLabel={title}
                disabled={!!active}
                onPress={() => enter("Record", { entry })}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.soft,
                  borderRadius: 14,
                  padding: 16,
                  gap: 10,
                  opacity: active ? 0.5 : pressed ? 0.7 : 1,
                })}
              >
                <Icon name={icon} />
                <Text style={[styles.body, { fontWeight: "500" }]}>
                  {title}
                </Text>
                <Body muted>按所选周补录</Body>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="工作日志管理" />
        <Card style={{ paddingTop: 7, paddingBottom: 7 }}>
          <RowLink
            title="学期谈话"
            icon="reader-outline"
            detail="完整工作日志名单 · 查看次数并补录"
            last
            onPress={() => !active && enter("WorklogTalk")}
          />
        </Card>
      </View>
      {saved && !active && (
        <Card style={{ paddingVertical: 6 }}>
          <RowLink
            title="恢复上次预览"
            icon="refresh-outline"
            detail="保留已选范围与核对进度"
            last
            onPress={async () => {
              try {
                const p = await get("/api/task/plans/" + saved);
                navigation.navigate(
                  p.request?.recordType === "worklog-talk"
                    ? "WorklogTalk"
                    : "Record",
                  {
                    entry: p.request?.entry || p.request?.recordType || "talk",
                  },
                );
              } catch (e) {
                E(e);
              }
            }}
          />
        </Card>
      )}
      <Body muted>先生成时间建议，核对实际记录后再提交。</Body>
    </Page>
  );
}
