import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { get, currentPlan } from "../utils/api";
import { Page, Card, Title, Body, Button, ErrorBox } from "../components/ui";
import { statusLabel } from "../utils/presentation";
export default function HomeScreen({ navigation }) {
  const [active, A] = useState(null),
    [plan, P] = useState(null),
    [error, E] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([get("/api/task/active"), currentPlan()])
        .then(([r, p]) => {
          if (live) {
            A(r.task);
            P(p);
            E(null);
          }
        })
        .catch((e) => live && E(e));
      return () => {
        live = false;
      };
    }, []),
  );
  return (
    <Page>
      <Title>每次录入，都先核对</Title>
      <Body>
        周次以学校系统核验结果为准。先选择人员和实际发生时间，再检查已有记录。
      </Body>
      <ErrorBox error={error} />
      {active && (
        <Card>
          <Body>进行中：{statusLabel(active.status)}</Body>
          <Button
            title="继续查看当前任务"
            onPress={() =>
              navigation.navigate("Progress", { taskUuid: active.taskUuid })
            }
          />
        </Card>
      )}
      {plan && !active && (
        <Button
          title="恢复上次检查预览"
          secondary
          onPress={() => navigation.navigate("Record")}
        />
      )}
      <Card>
        <Button
          title="录入谈话记录"
          disabled={!!active}
          onPress={() => navigation.navigate("Record", { type: "talk" })}
        />
        <Button
          title="录入陪伴记录"
          disabled={!!active}
          onPress={() => navigation.navigate("Record", { type: "companion" })}
        />
        <Button
          title="只补所选类型的缺失记录"
          secondary
          disabled={!!active}
          onPress={() => navigation.navigate("Record", { mode: "missing" })}
        />
        <Body muted>
          补录按学生、周次和具体记录类型核对，不依据“差几次”或单双周猜测。
        </Body>
      </Card>
      <Button
        title="账号、恢复码与周次设置"
        secondary
        onPress={() => navigation.getParent()?.navigate("SettingsTab")}
      />
    </Page>
  );
}
