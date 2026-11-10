// IDs and counts always come from the current workflow's own school snapshot.
export function filterPeople(students, query, mode, selected, missing) {
  const terms = String(query || "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return students.filter((s) => {
    const text = [s.name, s.studentId, s.major]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return (
      terms.every((q) => text.includes(q)) &&
      (mode !== "selected" || selected.has(s.studentId)) &&
      (mode !== "missing" || !!missing?.(s))
    );
  });
}
export function retainSelection(selected, students) {
  const allowed = new Set(students.map((s) => s.studentId));
  return [...new Set(selected)].filter((id) => allowed.has(id));
}
