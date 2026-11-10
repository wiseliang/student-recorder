import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  Page,
  Title,
  Body,
  Card,
  Button,
  ErrorBox,
  styles,
  Icon,
  colors,
} from "../components/ui";
import { getRecoveryKey, rotateRecoveryKey } from "../utils/api";
export default function RecoveryScreen() {
  const [key, K] = useState(null),
    [confirm, C] = useState(false),
    [error, E] = useState(null),
    [busy, B] = useState(false);
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
      <Title>迁移与恢复</Title>
      <Body muted>仅在换机或重装时使用，日常录入无需操作。</Body>
      <ErrorBox error={error} />
      <Card>
        <Icon name="key-outline" size={28} />
        <Body>保留原有任务记录</Body>
        <Body muted>
          恢复码可以在新设备恢复当前账户，持有者可访问你的任务历史，请私密保存。
        </Body>
        {key && (
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: colors.soft,
            }}
          >
            <Text selectable style={styles.body}>
              {key}
            </Text>
          </View>
        )}
        <Button
          title={key ? "隐藏恢复码" : "查看恢复码"}
          secondary
          loading={busy}
          onPress={() =>
            run(async () => K(key ? null : await getRecoveryKey()))
          }
        />
      </Card>
      <Card>
        <Body>重新生成恢复码</Body>
        <Body muted>新码生效后，旧码立即失效。</Body>
        {confirm ? (
          <>
            <Button
              title="确认生成新码"
              loading={busy}
              onPress={() =>
                run(async () => {
                  K(await rotateRecoveryKey());
                  C(false);
                })
              }
            />
            <Button title="保留原码" secondary onPress={() => C(false)} />
          </>
        ) : (
          <Button title="重新生成" secondary onPress={() => C(true)} />
        )}
      </Card>
    </Page>
  );
}
