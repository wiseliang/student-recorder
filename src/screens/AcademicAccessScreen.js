import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "react-native";
import { get, post } from "../utils/api";
import {
  Page,
  Title,
  Body,
  Card,
  Button,
  Field,
  ErrorBox,
} from "../components/ui";
export default function AcademicAccessScreen({ navigation, route }) {
  const [data, D] = useState(null),
    [code, C] = useState(""),
    [error, E] = useState(null),
    [busy, B] = useState(false);
  const alive = useRef(true);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      let timer;
      const poll = async () => {
        try {
          const r = await get("/api/academic-access/status");
          if (alive.current) {
            D(r);
            if (r.busy) timer = setTimeout(poll, 1800);
          }
        } catch (e) {
          if (alive.current) E(e);
        }
      };
      void poll();
      return () => {
        alive.current = false;
        clearTimeout(timer);
      };
    }, []),
  );
  const run = async (path, body) => {
    B(true);
    E(null);
    try {
      let r = await post("/api/academic-access/" + path, body);
      D(r);
      while (r.busy && alive.current) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        r = await get("/api/academic-access/status");
        if (alive.current) D(r);
      }
      C("");
    } catch (e) {
      E(e);
    } finally {
      B(false);
    }
  };
  return (
    <Page>
      <Title>教务连接</Title>
      <Body muted>
        使用已保存学校账号连接教务系统。需要二次验证时，请查看 HIT APP 本次验证码。
      </Body>
      <ErrorBox error={error} />
      <Card>
        <Body>{data?.message || "尚未连接教务系统"}</Body>
        {data?.connected && <Body>连接已核验，可返回学业查询；本次会话空闲15分钟后释放。</Body>}
        {data?.captchaImage && (
          <Image
            source={{ uri: data.captchaImage }}
            style={{ width: 220, height: 80 }}
            resizeMode="contain"
          />
        )}
        {["code", "captcha"].includes(data?.step) && (
          <>
            <Field
              label={data?.step === "captcha" ? "学校图片验证码" : "HIT APP 本次验证码"}
              value={code}
              onChangeText={C}
              keyboardType={data?.step === "captcha" ? "default" : "number-pad"}
            />
            <Button
              title="提交验证码并继续"
              disabled={!code.trim()}
              loading={busy}
              onPress={() => run("code", { code })}
            />
          </>
        )}
        {data?.step === "code" && <Button secondary title="重新获取HIT APP验证码" disabled={busy || data?.busy} onPress={() => run("request-code")} />}
        {data?.connected && <Button title={route?.params?.returnTo === "AcademicScope" ? "返回专业班级设置" : "进入成绩查询"} onPress={() => route?.params?.returnTo === "AcademicScope" ? navigation.goBack() : navigation.navigate("AcademicGrades")} />}
        <Button
          title="连接学校 VPN 与新教务"
          disabled={busy || data?.busy}
          loading={busy}
          onPress={() => run("start")}
        />
        <Button
          secondary
          title="断开教务连接"
          disabled={busy || data?.busy}
          onPress={() => run("release")}
        />
      </Card>
    </Page>
  );
}
