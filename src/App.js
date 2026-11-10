import React, { useEffect, useState } from "react";
import { View, StatusBar } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SchoolProvider } from "./state/SchoolContext";
import HomeScreen from "./screens/HomeScreen";
import RecordScreen from "./screens/RecordScreen";
import WorklogTalkScreen from "./screens/WorklogTalkScreen";
import ProgressScreen from "./screens/ProgressScreen";
import ResultScreen from "./screens/ResultScreen";
import HistoryScreen from "./screens/HistoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SchoolLoginScreen from "./screens/SchoolLoginScreen";
import RecoveryScreen from "./screens/RecoveryScreen";
import WeekSettingsScreen from "./screens/WeekSettingsScreen";
import TaskDetailsScreen from "./screens/TaskDetailsScreen";
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
  Icon,
  RowLink,
  colors,
} from "./components/ui";
const Stack = createNativeStackNavigator(),
  Tab = createBottomTabNavigator();
function Screens({ initial, component }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontSize: 17, fontWeight: "500" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name={initial}
        component={component}
        options={{ headerShown: false }}
      />
      {[
        ["Record", RecordScreen, "学情日志"],
        ["WorklogTalk", WorklogTalkScreen, "工作日志"],
        ["Progress", ProgressScreen, "录入进度"],
        ["Result", ResultScreen, "任务结果"],
        ["TaskDetails", TaskDetailsScreen, "记录明细"],
        ["WeekSettings", WeekSettingsScreen, "学校校历"],
        ["SchoolLogin", SchoolLoginScreen, "学校账号"],
        ["Recovery", RecoveryScreen, "迁移与恢复"],
      ].map(([name, component, title]) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={{ title }}
        />
      ))}
    </Stack.Navigator>
  );
}
const Home = () => <Screens initial="Home" component={HomeScreen} />,
  History = () => <Screens initial="History" component={HistoryScreen} />,
  Settings = () => <Screens initial="Settings" component={SettingsScreen} />;
function Root() {
  const safe=useSafeAreaInsets();
  const [ready, R] = useState(false),
    [busy, B] = useState(false),
    [error, E] = useState(null),
    [code, C] = useState(""),
    [recovery, V] = useState(false);
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
      <Page contentStyle={{ paddingTop: 76 }}>
        <View style={{ gap: 12 }}>
          <Icon name="leaf-outline" size={34} />
          <Title>学工录入助手</Title>
          <Body muted>连接记录，开始今天的工作。</Body>
        </View>
        <Card>
          <Body>{busy ? "正在连接你的工作记录…" : "连接尚未完成"}</Body>
          <ErrorBox error={error} />
          {!busy && <Button title="重新连接" onPress={init} />}
        </Card>
        {error && (
          <>
            <RowLink title="恢复原设备记录" last onPress={() => V(!recovery)} />
            {recovery && (
              <Card>
                <Field label="恢复码" value={code} onChangeText={C} />
                <Button
                  title="恢复账户"
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
              </Card>
            )}
          </>
        )}
      </Page>
    );
  return (
    <SchoolProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.muted,
            tabBarLabelStyle: { fontSize: 12, paddingBottom: 3 },
            tabBarStyle: {
              height: 66 + safe.bottom,
              paddingTop: 7,
              paddingBottom: 8 + safe.bottom,
              borderTopColor: colors.line,
              backgroundColor: colors.surface,
            },
          }}
        >
          {[
            ["HomeTab", Home, "工作台", "grid-outline"],
            ["HistoryTab", History, "记录", "time-outline"],
            ["SettingsTab", Settings, "我的", "person-outline"],
          ].map(([name, component, label, icon]) => (
            <Tab.Screen
              key={name}
              name={name}
              component={component}
              options={{
                tabBarLabel: label,
                tabBarIcon: ({ color }) => (
                  <Icon name={icon} color={color} size={22} />
                ),
              }}
            />
          ))}
        </Tab.Navigator>
      </NavigationContainer>
    </SchoolProvider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <Root />
    </SafeAreaProvider>
  );
}
