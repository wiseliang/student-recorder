import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import WorklogTalkScreen from "./screens/WorklogTalkScreen";
import HomeScreen from "./screens/HomeScreen";
import RecordScreen from "./screens/RecordScreen";
import ProgressScreen from "./screens/ProgressScreen";
import ResultScreen from "./screens/ResultScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WeekSettingsScreen from "./screens/WeekSettingsScreen";
import {
  initializeIdentity,
  recoverIdentity,
  onIdentityLost,
} from "./utils/api";
import {
  Page,
  Card,
  Title,
  Body,
  Button,
  Field,
  ErrorBox,
  colors,
} from "./components/ui";
const Stack = createNativeStackNavigator(),
  Tab = createBottomTabNavigator();
const options = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: "#FFF",
  headerTitleStyle: { fontWeight: "600" },
};
function Screens({ initial, component }) {
  return (
    <Stack.Navigator screenOptions={options}>
      <Stack.Screen
        name={initial}
        component={component}
        options={{
          title:
            initial === "Home"
              ? "学工录入助手"
              : initial === "History"
                ? "任务历史"
                : "设置",
        }}
      />
      <Stack.Screen
        name="Record"
        component={RecordScreen}
        options={{ title: "核对与录入" }}
      />
      <Stack.Screen
        name="WorklogTalk"
        component={WorklogTalkScreen}
        options={{ title: "工作日志 · 学期谈话" }}
      />
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: "任务进度" }}
      />
      <Stack.Screen
        name="Result"
        component={ResultScreen}
        options={{ title: "任务结果" }}
      />
      <Stack.Screen
        name="WeekSettings"
        component={WeekSettingsScreen}
        options={{ title: "学校学期与周次" }}
      />
    </Stack.Navigator>
  );
}
const Home = () => <Screens initial="Home" component={HomeScreen} />,
  History = () => <Screens initial="History" component={HistoryScreen} />,
  Settings = () => <Screens initial="Settings" component={SettingsScreen} />;
export default function App() {
  const [ready, R] = useState(false),
    [busy, B] = useState(false),
    [error, E] = useState(null),
    [code, C] = useState("");
  const init = async () => {
    B(true);
    E(null);
    try {
      await initializeIdentity();
      R(true);
    } catch (e) {
      E(e);
    } finally {
      B(false);
    }
  };
  useEffect(() => {
    init();
    return onIdentityLost((e) => {
      R(false);
      E(e);
    });
  }, []);
  if (!ready)
    return (
      <Page>
        <Title>学工录入助手</Title>
        <Card>
          <Body>正在连接你的工作记录</Body>
          <ErrorBox error={error} />
          <Button title="连接服务器" loading={busy} onPress={init} />
          <Field
            label="恢复码（换机或恢复原账户）"
            value={code}
            onChangeText={C}
          />
          <Button
            title="恢复原账户和历史"
            secondary
            disabled={!code.trim()}
            loading={busy}
            onPress={async () => {
              B(true);
              try {
                await recoverIdentity(code.trim());
                R(true);
                C("");
              } catch (e) {
                E(e);
              } finally {
                B(false);
              }
            }}
          />
          <Body muted>
            原账户不会因网络错误或会话过期被自动替换。请保留旧设备数据。
          </Body>
        </Card>
      </Page>
    );
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 14 },
          tabBarStyle: { minHeight: 60, paddingBottom: 6 },
        }}
      >
        {[
          ["HomeTab", Home, "首页", "⌂"],
          ["HistoryTab", History, "历史", "☷"],
          ["SettingsTab", Settings, "设置", "⚙"],
        ].map(([name, component, label, icon]) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarLabel: label,
              tabBarIcon: ({ color }) => (
                <Text style={{ color, fontSize: 24 }}>{icon}</Text>
              ),
            }}
          />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
