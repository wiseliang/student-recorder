import { useEffect } from "react";
import { cacheWrite } from "./api";
// Keep reusable settings separate from this school's people, dates and notes.
export function useFlowDraft({
  enabled,
  draftKey,
  preferenceKey,
  draft,
  preferences,
}) {
  const draftText = JSON.stringify(draft),
    preferenceText = JSON.stringify(preferences);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void Promise.all([
        cacheWrite(draftKey, JSON.parse(draftText)),
        cacheWrite(preferenceKey, JSON.parse(preferenceText)),
      ]).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [enabled, draftKey, preferenceKey, draftText, preferenceText]);
}
