import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  Card,
  Body,
  MetricRow,
  colors,
  styles,
  Choice,
  Button,
  Field,
} from "./ui";
import {
  taskTitle,
  semesterLabel,
  outcome,
  operationLabels,
  dateLabel,
} from "../utils/presentation";
export default function TaskView({ task }) {
  const [filter, F] = useState(false),
    [query, Q] = useState(""),
    [limit, L] = useState(50);
  const details = (task.details || []).filter(
    (d) =>
      (!filter ||
        ["failed", "unconfirmed", "planned", "cancelled"].includes(d.status)) &&
      (!query || d.name?.includes(query) || d.studentId?.includes(query)),
  );

  return (
    <>
      <Card>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.title,
            {
              color:
                task.status === "completed"
                  ? colors.success
                  : ["failed", "interrupted", "partial_failed"].includes(
                        task.status,
                      )
                    ? colors.danger
                    : colors.ink,
            },
          ]}
        >
          {outcome(task)}
        </Text>
        <Body>{taskTitle(task)}</Body>
        <Body muted>{semesterLabel(task.calendar)}</Body>
        <Body muted>{dateLabel(task.createdAt)}</Body>
        <MetricRow
          values={[
            ["总项数", task.total],
            ["已处理", task.progress?.processed || 0],
            ["已保存", task.progress?.success || 0],
            ["跳过", task.progress?.skipped || 0],
            ["失败", task.progress?.error || 0],
            ["待回查", task.progress?.unconfirmed || 0],
          ]}
        />
        {task.failureReason && <Body>{task.failureReason}</Body>}
        {["pause_requested", "cancel_requested"].includes(task.status) && (
          <Body>
            当前记录可能正在保存。系统将在当前操作安全结束后暂停或停止，请以最终回查结果为准。
          </Body>
        )}
      </Card>
      {task.legacy && (
        <Card>
          <Body>
            旧版任务仅能展示已有历史摘要；若曾中断，请在学校网页核对，不能自动重复提交。
          </Body>
        </Card>
      )}
      {!!task.details?.length && (
        <Card>
          <Choice
            label="只看失败、待回查及未执行项"
            selected={filter}
            onPress={() => {
              F(!filter);
              L(50);
            }}
          />
          <Field
            label="按姓名或学号筛选结果"
            value={query}
            onChangeText={(text) => {
              Q(text);
              L(50);
            }}
          />
          <Body muted>匹配 {details.length} 项，按学号和周次分别显示。</Body>
        </Card>
      )}
      {details.slice(0, limit).map((d, i) => (
        <Card key={d.id || d.studentId + "-" + d.week + "-" + i}>
          <Body>
            {d.name || d.studentId} · {d.studentId || "旧版未保存学号"} ·{" "}
            {d.week ? "第" + d.week + "周" : "原任务周次"}
          </Body>
          <Body>
            {operationLabels[d.status] || d.status || "旧版记录"}
            {d.recordedAt ? " · " + d.recordedAt : ""}
          </Body>
          {d.reason && <Body muted>{d.reason}</Body>}
          {d.receipt && (
            <Body muted>学校回执：{JSON.stringify(d.receipt)}</Body>
          )}
        </Card>
      ))}
      {details.length > limit && (
        <Button
          title="继续显示 50 项结果"
          secondary
          onPress={() => L((n) => n + 50)}
        />
      )}
    </>
  );
}
