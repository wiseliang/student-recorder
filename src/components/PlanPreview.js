import React, { useState } from "react";
import { View, Text, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Page,
  Card,
  Body,
  Button,
  Field,
  MetricRow,
  Pill,
  IconButton,
  ErrorBox,
  styles,
  colors,
} from "./ui";
import { DateField, TimeField } from "./DateControls";
import { operationLabels } from "../utils/presentation";
export default function PlanPreview({ plan, onEdit, busy, error }) {
  const [purpose, FP] = useState("all");
  const [all, A] = useState(false),
    [edit, E] = useState(null),
    [date, D] = useState(""),
    [time, T] = useState(""),
    [content, C] = useState("");
  const open = (op, index) => {
      E({ op, index });
      D((op.payload.recordedAt || "").slice(0, 10));
      T((op.payload.recordedAt || "").slice(11, 16));
      C(op.payload.content || "");
    },
    close = () => (edit ? E(null) : A(false));
  const row = ({ item: { op, index } }) => (
    <View
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: colors.line,
        gap: 7,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text style={[styles.body, { fontWeight: "500", flex: 1 }]}>
          {op.studentName} · 第 {op.week} 周
          {op.occurrence > 1 ? ` · 第 ${op.occurrence} 条` : ""}
        </Text>
        <Pill>{op.type === "companion" ? "陪伴" : "谈话"}</Pill>
      </View>
      <Body muted>
        {op.status === "planned"
          ? op.payload.recordedAt
          : operationLabels[op.status] || op.status}
      </Body>
      {op.reason && <Body muted>{op.reason}</Body>}
      {op.payload?.ruleVersion === 2 && op.status === "planned" && (
        <Body muted>
          {op.type === "talk"
            ? `场景：${op.payload.scene}`
            : `陪伴：${op.payload.pbType}`}{" "}
          · 本周学校要求 {op.payload.schoolRequirementAtPreview?.required}{" "}
          次，已计 {op.payload.schoolRequirementAtPreview?.completed} 次
        </Body>
      )}
      {op.status === "planned" && plan.state === "ready" && !plan.usedBy && (
        <Button secondary title="核对或修改" onPress={() => open(op, index)} />
      )}
    </View>
  );
  const rows = (plan.operations || [])
      .map((op, index) => ({ op, index }))
      .filter(
        ({ op }) =>
          purpose === "all" ||
          (purpose === "not_applicable" && op.status === "not_applicable") ||
          op.payload.academicGoal === purpose,
      ),
    save = async () => {
      const ok = await onEdit({
        operationIndex: edit.index,
        recordedAt: date + " " + time + ":00",
        content,
      });
      if (ok) E(null);
    },
    today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    });
  let minDate = plan.calendar?.startDate,
    maxDate = today;
  if (edit && plan.request?.scope === "academic") {
    const start =
      Date.parse(plan.calendar.startDate + "T00:00:00Z") +
      (edit.op.week - 1) * 7 * 86400000;
    minDate = new Date(start).toISOString().slice(0, 10);
    maxDate = [
      new Date(start + 6 * 86400000).toISOString().slice(0, 10),
      today,
    ].sort()[0];
  }
  return (
    <>
      <Card>
        <Body>
          {plan.state === "scanning"
            ? `正在核对 ${plan.processed || 0} / ${plan.total || 0} 项`
            : {
                ready: "时间建议已生成",
                failed: "核对未完成",
                cancelled: "核对已停止",
                interrupted: "核对已中断",
              }[plan.state] || "核对预览"}
        </Body>
        <MetricRow
          values={[
            ["待录入", plan.summary?.planned || 0],
            ["已有记录", plan.summary?.skipped || 0],
            ["未安排", plan.summary?.not_applicable || 0],
          ]}
        />
        <Body muted>
          请核对是否与实际完成的工作一致。达到学校次数和对应轮次后才跳过，时间不会安排到未来。
        </Body>
        {plan.error && (
          <Body style={{ color: colors.danger }}>{plan.error}</Body>
        )}
        {!!plan.ruleWarnings?.length && (
          <Body style={{ color: colors.warning }}>
            本入口只处理对应类型；另有 {plan.ruleWarnings.length}{" "}
            项其他轮次举措未补齐，可从一键录入处理。
          </Body>
        )}
        <Body muted>
          共 {new Set((plan.operations || []).map((o) => o.studentId)).size} 人
          · {(plan.operations || []).length} 条记录项
        </Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            ["all", "全部"],
            ["count", "补次数"],
            ["visit", "补走访"],
            ["companion", "补陪伴"],
            ["not_applicable", "未安排"],
          ].map(([value, label]) => (
            <Button
              key={value}
              secondary={purpose !== value}
              title={label}
              onPress={() => FP(value)}
            />
          ))}
        </View>
        {rows.slice(0, 3).map((item) => (
          <View key={item.index}>{row({ item })}</View>
        ))}
        {rows.length > 3 && (
          <Button
            title={`查看全部 ${rows.length} 项`}
            secondary
            onPress={() => A(true)}
          />
        )}
      </Card>
      <Modal
        visible={all || !!edit}
        animationType="slide"
        onRequestClose={close}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingHorizontal: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.title}>{edit ? "核对记录" : "核对预览"}</Text>
            <IconButton
              name="close"
              label={edit ? "关闭记录编辑" : "关闭全部预览"}
              onPress={close}
            />
          </View>
          {edit ? (
            <Page
              footer={
                <Button title="保存并校验" loading={busy} onPress={save} />
              }
            >
              <Body>
                {edit.op.studentName} · 第 {edit.op.week} 周 ·{" "}
                {edit.op.type === "companion" ? "陪伴" : "谈话"}
              </Body>
              <ErrorBox error={error} />
              <DateField
                label="实际日期"
                value={date}
                onChange={D}
                minDate={minDate}
                maxDate={maxDate}
              />
              <View style={{ flexDirection: "row" }}>
                <TimeField
                  label="实际时间（北京时间）"
                  value={time}
                  onChange={T}
                />
              </View>
              <Field
                label="内容（选填）"
                value={content}
                onChangeText={C}
                multiline
                maxLength={250}
              />
            </Page>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => String(item.index)}
              renderItem={row}
              contentContainerStyle={{ padding: 24 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
