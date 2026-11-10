import React from "react";
import { View, Text } from "react-native";
import { Card, Body, MetricRow, Button, Pill, colors, styles } from "./ui";
import {
  taskTitle,
  semesterLabel,
  outcome,
  dateLabel,
} from "../utils/presentation";
export default function TaskView({ task, navigation }) {
  const done = task.progress?.processed || 0,
    total = task.total || 0;
  return (
    <>
      <View style={{ gap: 8 }}>
        <Pill>
          {task.type === "worklog-talk" ? "工作日志管理" : "学情日志"}
        </Pill>
        <Text accessibilityLiveRegion="polite" style={styles.title}>
          {outcome(task)}
        </Text>
        <Body muted>
          {taskTitle(task)} · {semesterLabel(task.calendar)}
        </Body>
      </View>
      <Card>
        <View
          style={{
            height: 7,
            borderRadius: 4,
            backgroundColor: colors.tint,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 7,
              width: (total ? Math.min(100, (done / total) * 100) : 0) + "%",
              backgroundColor: colors.primary,
              borderRadius: 4,
            }}
          />
        </View>
        <Body>
          {done} / {total} 项已处理
        </Body>
        <MetricRow
          values={[
            ["已保存", task.progress?.success || 0],
            ["已跳过", task.progress?.skipped || 0],
            ["失败", task.progress?.error || 0],
            ["待回查", task.progress?.unconfirmed || 0],
          ]}
        />
        {task.currentStudent && <Body muted>{task.currentStudent}</Body>}
        {task.failureReason && (
          <Body style={{ color: colors.danger }}>{task.failureReason}</Body>
        )}
        {["pause_requested", "cancel_requested"].includes(task.status) && (
          <Body muted>等待当前记录安全结束，请以最终结果为准。</Body>
        )}
        <Body muted>{dateLabel(task.createdAt)}</Body>
        {!!task.details?.length && (
          <Button
            title={`查看 ${task.details.length} 项明细`}
            secondary
            onPress={() =>
              navigation.navigate("TaskDetails", { taskUuid: task.taskUuid })
            }
          />
        )}
      </Card>
      {task.legacy && (
        <Body muted>旧版任务保留历史摘要，重试前请核对学校记录。</Body>
      )}
    </>
  );
}
