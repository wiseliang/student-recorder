import React from "react";
import { View, Text } from "react-native";
import { useSchool, openSchool } from "../state/SchoolContext";
import { Card, Body, Button, Icon, colors } from "./ui";
export default function SchoolGate({ navigation, children, intent }) {
  const { school, error, refresh } = useSchool();
  if (school.loading)
    return (
      <Card>
        <Body muted>正在读取学校连接…</Body>
      </Card>
    );
  if (!school.hasActiveSession)
    return (
      <Card>
        <View style={{ gap: 12 }}>
          <Icon name="school-outline" size={30} />
          <Body>先连接学校账号</Body>
          <Body muted>
            {error
              ? "连接状态暂时无法读取，可稍后重试。"
              : "连接后可在所有录入页复用，无需逐页登录。"}
          </Body>
          <Button
            title="连接学校账号"
            onPress={() => openSchool(navigation, intent)}
          />
          {error && (
            <Button
              title="重新读取连接状态"
              secondary
              onPress={() => refresh().catch(() => {})}
            />
          )}
        </View>
      </Card>
    );
  return children;
}
