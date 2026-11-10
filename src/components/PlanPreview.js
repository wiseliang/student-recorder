import React, { useState } from "react";
import { View, Text, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  Body,
  Button,
  Field,
  MetricRow,
  Pill,
  IconButton,
  styles,
  colors,
} from "./ui";
import { DateField, TimeField } from "./DateControls";
import { operationLabels } from "../utils/presentation";
export default function PlanPreview({ plan, onEdit, busy }) {
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
  };
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
        </Text>
        <Pill>{op.type === "companion" ? "陪伴" : "谈话"}</Pill>
      </View>
      <Body muted>
        {op.status === "planned"
          ? op.payload.recordedAt
          : operationLabels[op.status] || op.status}
      </Body>
      {op.reason && <Body muted>{op.reason}</Body>}
      {op.status === "planned" && !plan.usedBy && (
        <Button secondary title="核对或修改" onPress={() => open(op, index)} />
      )}
    </View>
  );
  const rows = (plan.operations || []).map((op, index) => ({ op, index }));
  return (
    <>
      <Card>
        <Body>
          {plan.state === "scanning"
            ? `正在核对 ${plan.processed || 0} / ${plan.total || 0} 项`
            : "时间建议已生成"}
        </Body>
        <MetricRow
          values={[
            ["待录入", plan.summary?.planned || 0],
            ["已有记录", plan.summary?.skipped || 0],
            ["未安排", plan.summary?.not_applicable || 0],
          ]}
        />
        <Body muted>
          请核对是否与实际完成的工作一致。已有记录自动跳过，时间不会安排到未来。
        </Body>
        {plan.error && (
          <Body style={{ color: colors.danger }}>{plan.error}</Body>
        )}
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
        visible={all}
        animationType="slide"
        onRequestClose={() => A(false)}
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
            <Text style={styles.title}>核对预览</Text>
            <IconButton
              name="close"
              label="关闭全部预览"
              onPress={() => A(false)}
            />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.index)}
            renderItem={row}
            contentContainerStyle={{ padding: 24 }}
          />
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!edit}
        animationType="slide"
        onRequestClose={() => E(null)}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: colors.background,
            padding: 24,
            gap: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.title}>核对记录</Text>
            <IconButton
              name="close"
              label="关闭记录编辑"
              onPress={() => E(null)}
            />
          </View>
          <Body>
            {edit?.op.studentName} · 第 {edit?.op.week} 周 ·{" "}
            {edit?.op.type === "companion" ? "陪伴" : "谈话"}
          </Body>
          <DateField
            label="实际日期"
            value={date}
            onChange={D}
            minDate={plan.calendar?.startDate}
            maxDate={new Date().toLocaleDateString("sv-SE", {
              timeZone: "Asia/Shanghai",
            })}
          />
          <TimeField label="实际时间（北京时间）" value={time} onChange={T} />
          <Field
            label="内容（选填）"
            value={content}
            onChangeText={C}
            multiline
            maxLength={250}
          />
          <Button
            title="保存并校验"
            loading={busy}
            onPress={async () => {
              const ok = await onEdit({
                operationIndex: edit.index,
                recordedAt: date + " " + time + ":00",
                content,
              });
              if (ok) E(null);
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
