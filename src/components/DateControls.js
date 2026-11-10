import React, { useState } from "react";
import { Modal, View, Text, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Icon, IconButton, Body, colors, styles } from "./ui";
function iso(d) {
  return d.toISOString().slice(0, 10);
}
export function CalendarModal({
  visible,
  onClose,
  onConfirm,
  selected = [],
  multiple = false,
  minDate,
  maxDate,
  title = "选择日期",
}) {
  const [dates, D] = useState(selected),
    [month, M] = useState(
      (selected[0] || minDate || iso(new Date())).slice(0, 7),
    );
  React.useEffect(() => {
    if (visible) {
      D(selected);
      M((selected[0] || minDate || iso(new Date())).slice(0, 7));
    }
  }, [visible]);
  const first = new Date(month + "-01T00:00:00Z"),
    offset = (first.getUTCDay() + 6) % 7,
    days = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate(),
    grid = Array.from(
      { length: Math.ceil((offset + days) / 7) * 7 },
      (_, i) => i - offset + 1,
    ),
    change = (n) =>
      M(
        iso(
          new Date(
            Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1),
          ),
        ).slice(0, 7),
      );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#12325255",
        }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            gap: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.heading}>{title}</Text>
            <IconButton name="close" label="关闭日历" onPress={onClose} />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <IconButton
              name="chevron-back"
              label="上个月"
              onPress={() => change(-1)}
            />
            <Text style={styles.heading}>{month.replace("-", " 年 ")} 月</Text>
            <IconButton
              name="chevron-forward"
              label="下个月"
              onPress={() => change(1)}
            />
          </View>
          <View style={{ flexDirection: "row" }}>
            {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
              <Text
                key={w}
                style={{
                  width: "14.285%",
                  textAlign: "center",
                  fontSize: 14,
                  color: colors.muted,
                  paddingBottom: 12,
                }}
              >
                {w}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {grid.map((day, index) => {
              if (day < 1 || day > days)
                return (
                  <View key={index} style={{ width: "14.285%", height: 46 }} />
                );
              const value = month + "-" + String(day).padStart(2, "0"),
                disabled = !!(
                  (minDate && value < minDate) ||
                  (maxDate && value > maxDate)
                ),
                chosen = dates.includes(value);
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={value}
                  accessibilityState={{ selected: chosen, disabled }}
                  disabled={disabled}
                  onPress={() =>
                    D((old) =>
                      multiple
                        ? old.includes(value)
                          ? old.filter((d) => d !== value)
                          : [...old, value].sort()
                        : [value],
                    )
                  }
                  style={{
                    width: "14.285%",
                    height: 46,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: chosen ? colors.primary : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: disabled
                          ? "#B8C6D4"
                          : chosen
                            ? "#FFF"
                            : colors.ink,
                        fontWeight: chosen ? "500" : "400",
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {multiple && (
            <Body muted>已选 {dates.length} 天，点击已选日期可取消</Body>
          )}
          <Button
            title={multiple ? `确认 ${dates.length} 个排除日期` : "确认日期"}
            disabled={!multiple && !dates.length}
            onPress={() => onConfirm(dates)}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export function DateField({ label, value, onChange, minDate, maxDate }) {
  const [open, O] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.ink }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => O(true)}
        style={[
          styles.input,
          { flexDirection: "row", alignItems: "center", gap: 10 },
        ]}
      >
        <Icon name="calendar-outline" size={19} />
        <Text style={[styles.body, { flex: 1 }]}>{value || "选择日期"}</Text>
        <Icon name="chevron-down" size={16} />
      </Pressable>
      <CalendarModal
        visible={open}
        onClose={() => O(false)}
        onConfirm={(v) => {
          onChange(v[0]);
          O(false);
        }}
        selected={value ? [value] : []}
        minDate={minDate}
        maxDate={maxDate}
        title={label}
      />
    </View>
  );
}
export function ExcludedDates({ value = [], onChange, minDate, maxDate }) {
  const [open, O] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="选择排除日期"
        onPress={() => O(true)}
        style={{
          minHeight: 54,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Icon name="calendar-clear-outline" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.body}>排除日期</Text>
          <Body muted>
            {value.length ? `已排除 ${value.length} 天` : "节假日或不在岗日期"}
          </Body>
        </View>
        <Icon name="chevron-forward" size={18} />
      </Pressable>
      {value.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {value.slice(0, 8).map((d) => (
            <View
              key={d}
              style={{
                backgroundColor: colors.tint,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 9,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.primary }}>
                {d.slice(5).replace("-", "月")}日
              </Text>
            </View>
          ))}
          {value.length > 8 && <Body muted>等 {value.length} 天</Body>}
        </View>
      )}
      <CalendarModal
        visible={open}
        multiple
        selected={value}
        minDate={minDate}
        maxDate={maxDate}
        title="排除日期"
        onClose={() => O(false)}
        onConfirm={(dates) => {
          onChange(dates);
          O(false);
        }}
      />
    </View>
  );
}
export function TimeField({ label, value, onChange }) {
  const [open, O] = useState(false);
  const date = new Date("2026-01-01T" + (value || "09:00") + ":00");
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Text style={{ fontSize: 14, color: colors.ink, fontWeight: "500" }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => O(true)}
        style={[
          styles.input,
          {
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          },
        ]}
      >
        <Text style={styles.body}>{value}</Text>
        <Icon name="time-outline" size={17} />
      </Pressable>
      {open &&
        (Platform.OS === "web" ? (
          <Modal transparent visible onRequestClose={() => O(false)}>
            <View
              style={{
                flex: 1,
                backgroundColor: "#12325255",
                justifyContent: "center",
                padding: 32,
              }}
            >
              <View style={[styles.card, { gap: 16 }]}>
                <Text style={styles.heading}>{label}</Text>
                {React.createElement("input", {
                  type: "time",
                  value,
                  onChange: (e) => onChange(e.target.value),
                  style: {
                    fontSize: 22,
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid #D9E4F0",
                    fontFamily: "inherit",
                  },
                })}
                <Button title="确认时间" onPress={() => O(false)} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={date}
            mode="time"
            is24Hour
            onChange={(e, d) => {
              O(false);
              if (e.type !== "dismissed" && d)
                onChange(
                  String(d.getHours()).padStart(2, "0") +
                    ":" +
                    String(d.getMinutes()).padStart(2, "0"),
                );
            }}
          />
        ))}
    </View>
  );
}
export function WorkHours({ shifts, onChange }) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TimeField
          label="上午开始"
          value={shifts[0][0]}
          onChange={(v) => onChange([[v, shifts[0][1]], shifts[1]])}
        />
        <TimeField
          label="上午结束"
          value={shifts[0][1]}
          onChange={(v) => onChange([[shifts[0][0], v], shifts[1]])}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TimeField
          label="下午开始"
          value={shifts[1][0]}
          onChange={(v) => onChange([shifts[0], [v, shifts[1][1]]])}
        />
        <TimeField
          label="下午结束"
          value={shifts[1][1]}
          onChange={(v) => onChange([shifts[0], [shifts[1][0], v]])}
        />
      </View>
    </View>
  );
}
