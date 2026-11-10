import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
export const colors = {
  ink: "#172F3D",
  muted: "#506474",
  primary: "#176B62",
  surface: "#FFFFFF",
  background: "#F2F5F3",
  line: "#D4DFD9",
  danger: "#AB2836",
  success: "#236A43",
  warning: "#8B5A12",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 24 },
  heading: { fontSize: 18, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  error: { fontSize: 15, lineHeight: 23, color: colors.danger },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#FFF",
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#FFF" },
  choice: {
    minHeight: 46,
    padding: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: "center",
  },
  chosen: { borderColor: colors.primary, backgroundColor: "#E5F1EC" },
  number: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
});
export function Page({ children, refreshControl }) {
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export const Card = ({ children }) => (
  <View style={styles.card}>{children}</View>
);
export const Title = ({ children }) => (
  <Text style={styles.title}>{children}</Text>
);
export const Body = ({ children, muted = false }) => (
  <Text style={muted ? styles.muted : styles.body}>{children}</Text>
);
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  secondary = false,
  danger = false,
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.button,
        secondary && { backgroundColor: "#DFE9E2" },
        danger && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.55 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.primary : "#FFF"} />
      ) : (
        <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
export function ErrorBox({ error, onRetry, onLogin }) {
  if (!error) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: "#FCEDEF",
        borderRadius: 10,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={styles.error}>{error.message || String(error)}</Text>
      {onRetry && <Button title="重试" onPress={onRetry} secondary />}
      {onLogin && (
        <Button title="重新验证学校登录" onPress={onLogin} secondary />
      )}
    </View>
  );
}
export function Field({ label, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.input,
          props.multiline && { minHeight: 96, textAlignVertical: "top" },
        ]}
        placeholderTextColor="#65798A"
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}
export function Choice({ label, selected, onPress, detail }) {
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.choice, selected && styles.chosen]}
    >
      <Text style={styles.body}>
        {selected ? "☑ " : "☐ "}
        {label}
      </Text>
      {detail && <Text style={styles.muted}>{detail}</Text>}
    </TouchableOpacity>
  );
}
export function MetricRow({ values }) {
  return (
    <View style={styles.row}>
      {values.map(([label, value]) => (
        <View key={label} style={{ minWidth: 84, flexGrow: 1, gap: 4 }}>
          <Text style={styles.number}>{value}</Text>
          <Text style={styles.muted}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
