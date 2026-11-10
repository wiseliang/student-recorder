import React, { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  get,
  del,
  getRecoveryKey,
  rotateRecoveryKey,
  BASE_URL,
} from "../utils/api";
import { VERSION } from "../utils/presentation";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  ErrorBox,
  styles,
} from "../components/ui";
export default function SettingsScreen({ navigation }) {
  const [credential, C] = useState(null),
    [error, E] = useState(null),
    [busy, B] = useState(false),
    [key, K] = useState(null),
    [health, H] = useState(null),
    [confirm, F] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([get("/api/auth/credential"), get("/api/health")])
        .then(([c, h]) => {
          if (live) {
            C(c);
            H(h);
            E(null);
          }
        })
        .catch((e) => live && E(e));
      return () => {
        live = false;
      };
    }, []),
  );
  const run = async (fn) => {
    B(true);
    E(null);
    try {
      await fn();
    } catch (e) {
      E(e);
    } finally {
      B(false);
    }
  };
  return (
    <Page>
      <Title>账号与设置</Title>
      <ErrorBox error={error} />
      {error?.taskUuid && (
        <Button
          title="先查看进行中的任务"
          onPress={() =>
            navigation.navigate("Progress", { taskUuid: error.taskUuid })
          }
        />
      )}
      <Card>
        <Body>
          学校凭证：
          {credential?.hasCredential
            ? "服务器已加密保存 · " + credential.maskedId
            : "尚未保存"}
        </Body>
        <Body muted>学校账号是否可用，以录入前学校验证为准。</Body>
        <Button
          title="验证 / 更换学校账号"
          secondary
          onPress={() => navigation.navigate("Record")}
        />
        <Button
          title="删除服务器学校凭证和会话"
          danger
          loading={busy}
          onPress={() =>
            run(async () => {
              await del("/api/auth/credential");
              C({ hasCredential: false });
            })
          }
        />
        <Body muted>
          删除后保留本机身份和任务历史；存在录入任务时需先停止任务。
        </Body>
      </Card>
      <Card>
        <Body>身份恢复码</Body>
        <Body muted>
          请在换机、卸载前备份。持有恢复码可恢复本账户历史，请私密保存。恢复到新设备会撤销原设备登录。
        </Body>
        {key && (
          <Text selectable accessibilityLabel="身份恢复码" style={styles.body}>
            {key}
          </Text>
        )}
        <Button
          title={key ? "隐藏恢复码" : "显示本机恢复码，长按复制"}
          secondary
          onPress={() =>
            run(async () => K(key ? null : await getRecoveryKey()))
          }
        />
        {confirm ? (
          <>
            <Body>重新生成后原恢复码立即失效，请保存新码。</Body>
            <Button
              title="确认生成新恢复码"
              loading={busy}
              onPress={() =>
                run(async () => {
                  K(await rotateRecoveryKey());
                  F(false);
                })
              }
            />
            <Button title="保留原恢复码" secondary onPress={() => F(false)} />
          </>
        ) : (
          <Button title="重新生成恢复码" secondary onPress={() => F(true)} />
        )}
      </Card>
      <Card>
        <Button
          title="查看学校学期与周次"
          secondary
          onPress={() => navigation.navigate("WeekSettings")}
        />
        <Body>学工录入助手 {VERSION}</Body>
        <Body muted>服务端 {health?.version || "尚未连接"}</Body>
        <Body muted>{BASE_URL}</Body>
      </Card>
    </Page>
  );
}
