import React, { useEffect, useState } from "react";
import { get } from "../utils/api";
import { Page, Card, Title, Body, ErrorBox } from "../components/ui";
import SchoolLogin from "../components/SchoolLogin";
export default function WeekSettingsScreen() {
  const [calendar, C] = useState(null),
    [error, E] = useState(null);
  useEffect(() => {
    let live = true;
    get("/api/week")
      .then((c) => live && C(c))
      .catch((e) => live && E(e));
    return () => {
      live = false;
    };
  }, []);
  return (
    <Page>
      <Title>学校学期与周次</Title>
      <Body>
        以学校学工页面返回的学期和周次为依据，校历只读。需要修正时先核对学校数据，再由维护者更新。
      </Body>
      <ErrorBox error={error} />
      <SchoolLogin
        onReady={async (c) => {
          try {
            C(c || (await get("/api/auth/academic-calendar")));
            E(null);
          } catch (e) {
            E(e);
          }
        }}
      />
      {calendar && (
        <Card>
          <Body>
            {calendar.academicYear}学年 · {calendar.semester}
          </Body>
          <Body>第一周起始：{calendar.startDate}</Body>
          <Body>当前第 {calendar.week} 周</Body>
          <Body muted>
            {calendar.verified
              ? "已通过学校数据核验"
              : "全局参考数据；请先登录学校核验"}
          </Body>
          {calendar.weeks?.map((w) => (
            <Body key={w.week}>
              第{w.week}周 · {w.range}
            </Body>
          ))}
        </Card>
      )}
    </Page>
  );
}
