import React, { useRef, useState } from "react";
import { View, Text } from "react-native";
import { Page, Title, Body, Pill, Icon, colors, Card } from "../components/ui";
import SchoolLogin from "../components/SchoolLogin";
import { useSchool } from "../state/SchoolContext";
export default function SchoolLoginScreen({ route, navigation }) {
  const { connected } = useSchool(),
    done = useRef(false);
  return (
    <Page>
      <View style={{ gap: 12, paddingBottom: 4 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            backgroundColor: colors.tint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="school-outline" size={27} />
        </View>
        <Title>连接学校账号</Title>
        <Body muted>一次连接，学情日志、工作日志与校历共用。</Body>
      </View>
      <SchoolLogin
        force={route.params?.force}
        onReady={async (calendar) => {
          if (done.current) return;
          done.current = true;
          try {
            await connected(calendar);
            const intent = route.params?.intent;
            if (intent) navigation.replace(intent.screen, intent.params || {});
            else navigation.goBack();
          } catch (e) {
            done.current = false;
            throw e;
          }
        }}
      />
      <Body muted>
        连接状态最长保留 24 小时。学校端要求重新认证时，会提示你在这里重新登录。
      </Body>
    </Page>
  );
}
