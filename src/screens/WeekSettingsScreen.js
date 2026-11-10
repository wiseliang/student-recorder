import React from "react";
import { View } from "react-native";
import { Page, Card, Title, Body, Pill, RowLink } from "../components/ui";
import { useSchool } from "../state/SchoolContext";
import SchoolGate from "../components/SchoolGate";
export default function WeekSettingsScreen({ navigation }) {
  const { school } = useSchool(),
    c = school.calendar;
  return (
    <Page>
      <Title>学校校历</Title>
      <Body muted>学期与周次以学校页面为准，自动同步。</Body>
      <SchoolGate navigation={navigation}>
        {c && (
          <>
            <Card>
              <Pill tone="success">学校已核验</Pill>
              <Body>
                {c.academicYear}学年 · {c.semester}
              </Body>
              <Body>当前第 {c.week} 周</Body>
              <Body muted>第一周起始 {c.startDate}</Body>
            </Card>
            <Card>
              {c.weeks?.map((w) => (
                <View key={w.week} style={{ paddingVertical: 9 }}>
                  <Body>第 {w.week} 周</Body>
                  <Body muted>{w.range}</Body>
                </View>
              ))}
            </Card>
          </>
        )}
      </SchoolGate>
    </Page>
  );
}
