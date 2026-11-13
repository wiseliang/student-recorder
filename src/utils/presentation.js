export const VERSION = "1.13.0";
export const ACTIVE = [
  "queued",
  "running",
  "awaiting_input",
  "pause_requested",
  "paused",
  "cancel_requested",
];
export const statusLabels = {
  queued: "排队中",
  running: "执行中",
  awaiting_input: "需要验证",
  pause_requested: "等待安全暂停",
  paused: "已暂停",
  cancel_requested: "正在停止",
  cancelled: "已取消",
  completed: "已完成",
  partial_failed: "部分完成",
  failed: "失败",
  interrupted: "执行中断",
};
export const operationLabels = {
  planned: "未执行",
  in_progress: "正在处理",
  succeeded: "已保存并回查",
  skipped: "已跳过",
  not_applicable: "未安排，请查看原因",
  failed: "未保存，可重试",
  unconfirmed: "保存结果待回查",
  cancelled: "未执行，已取消",
};
export function taskTitle(task) {
  if (task.type === "worklog-talk") return "工作日志 · 学期谈话";
  const weeks = (task.weeks || []).filter((w) => Number.isInteger(w) && w > 0);
  return `${task.type === "academic-auto" ? "一键录入" : task.type === "companion" ? "陪伴" : "谈话"} · ${weeks.length === 1 ? "第" + weeks[0] + "周" : weeks.length ? "第" + weeks.join("、") + "周" : "旧版批量任务"}`;
}
export function semesterLabel(c) {
  return c ? `${c.academicYear}学年 · ${c.semester}` : "旧版记录，学期未保存";
}
export function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("zh-CN", { hour12: false })
    : String(value);
}
export function outcome(task) {
  if (task.status === "completed")
    return task.progress?.success ? "录入完成" : "检查完成，无需新增";
  return statusLabels[task.status] || "状态待确认";
}

export const statusLabel = (value) => statusLabels[value] || value;

export function operationLabel(row) {
  if (row.status === "skipped") return "已有记录，已跳过";
  if (
    row.status === "not_applicable" &&
    /尚未到|时间未到/.test(row.reason || "")
  )
    return "尚未到时间，未录入";
  return operationLabels[row.status] || row.status;
}
