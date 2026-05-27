const WEEK1 = new Date(2026, 2, 9)

export function getCurrentWeek() {
  const diff = Date.now() - WEEK1.getTime()
  return Math.max(1, Math.floor(diff / (7 * 86400000)) + 1)
}

export function getWeekType(w) { return w % 2 === 1 ? 'companion' : 'talk' }

export function getWeekRange(w) {
  const m = new Date(WEEK1); m.setDate(m.getDate() + (w - 1) * 7)
  const s = new Date(m); s.setDate(s.getDate() + 6)
  const f = d => `${d.getMonth()+1}`.padStart(2,'0') + '/' + `${d.getDate()}`.padStart(2,'0')
  return f(m) + '-' + f(s)
}
