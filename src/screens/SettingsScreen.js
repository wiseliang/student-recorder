import React, { useState, useCallback } from "react";
import { View, Text, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Page,
  Card,
  Title,
  Body,
  RowLink,
  Icon,
  Button,
  Pill,
  SectionHeader,
  ErrorBox,
  colors,
} from "../components/ui";
import { useSchool, openSchool } from "../state/SchoolContext";
import { get, post, del } from "../utils/api";
import { VERSION } from "../utils/presentation";
export default function SettingsScreen({ navigation }) {
  const { school, refresh } = useSchool(),
    [credential, C] = useState(null),
    [error, E] = useState(null),
    [advanced, A] = useState(false),
    [busy, B] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      get("/api/auth/credential")
        .then((c) => alive && C(c))
        .catch((e) => alive && E(e));
      return () => {
        alive = false;
      };
    }, []),
  );
  const run = async (fn) => {
    B(true);
    E(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      E(e);
    } finally {
      B(false);
    }
  };
  return (
    <Page>
      <Title>账号</Title>
      <ErrorBox error={error} />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 19,
              backgroundColor: colors.tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="school-outline" size={29} />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <Text
              style={{ fontSize: 20, fontWeight: "500", color: colors.ink }}
            >
              {school.profile || "学校账号"}
            </Text>
            <Pill tone={school.hasActiveSession ? "success" : "neutral"}>
              {school.hasActiveSession ? "已连接" : "未连接"}
            </Pill>
          </View>
        </View>
        <Body muted>
          {school.hasActiveSession
            ? "学校连接供所有业务页共用，最长保留 24 小时。"
            : "连接后可录入学情日志、工作日志，并同步校历。"}
        </Body>
        <Button
          title={school.hasActiveSession ? "切换学校账号" : "连接学校账号"}
          secondary={school.hasActiveSession}
          icon="log-in-outline"
          onPress={() =>
            openSchool(navigation, undefined, school.hasActiveSession)
          }
        />
        {credential?.hasCredential && (
          <Body muted>已保存账号 {credential.maskedId}</Body>
        )}
      </Card>
      <View style={{ gap: 12 }}>
        <SectionHeader title="学校数据" />
        <Card style={{ paddingVertical: 6 }}>
          <RowLink
            title="内容模板库"
            icon="document-text-outline"
            detail="学习、室友相处、职业规划等主题，可增删改"
            onPress={() => navigation.navigate("ContentTemplates")}
          />
          <RowLink
            title="学期与周次"
            icon="calendar-outline"
            detail={
              school.calendar
                ? `${school.calendar.academicYear} · ${school.calendar.semester}`
                : "连接后自动同步"
            }
            onPress={() => navigation.navigate("WeekSettings")}
          />
          <RowLink
            title="同步连接状态"
            icon="sync-outline"
            detail="复用已保存的连接"
            last
            onPress={() => run(refresh)}
          />
        </Card>
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="更多设置" />
        <Card style={{ paddingVertical: 6 }}>
          <RowLink
            title="高级设置"
            icon="options-outline"
            detail="数据迁移、凭证管理与连接诊断"
            last
            onPress={() => A(!advanced)}
          />
        </Card>
        {advanced && (
          <Card style={{ paddingVertical: 6 }}>
            <RowLink
              title="教务连接"
              icon="school-outline"
              detail="成绩查询、HIT APP验证与连接状态"
              onPress={() => navigation.navigate("AcademicAccess")}
            />
            <RowLink
              title="迁移与恢复"
              icon="key-outline"
              detail="换机或重装时使用"
              onPress={() => navigation.navigate("Recovery")}
            />
            <RowLink
              title="断开学校连接"
              icon="log-out-outline"
              detail="保留任务历史与已保存账号"
              onPress={() => run(() => post("/api/auth/release"))}
            />
            <RowLink
              title="删除已保存学校凭证"
              icon="trash-outline"
              detail="下次连接时重新填写密码"
              danger
              last
              onPress={() =>
                Alert.alert(
                  "删除学校凭证",
                  "保存的密码与学校连接将清除，任务历史保留。",
                  [
                    { text: "保留", style: "cancel" },
                    {
                      text: "删除",
                      style: "destructive",
                      onPress: () =>
                        run(async () => {
                          await del("/api/auth/credential");
                          C({ hasCredential: false });
                        }),
                    },
                  ],
                )
              }
            />
          </Card>
        )}
      </View>
      {busy && <Body muted>正在更新…</Body>}
      <Body muted style={{ textAlign: "center", paddingVertical: 12 }}>
        学工录入助手 {VERSION}
      </Body>
    </Page>
  );
}
