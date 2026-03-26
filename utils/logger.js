export function log(level, message, data = {}) {
  const entry = {
    ts:      new Date().toISOString(),
    level:   level.toUpperCase(),
    message,
    ...data
  }
  const line = JSON.stringify(entry)
  if (level === 'error' || level === 'warn') {
    console.error(line)
  } else {
    console.log(line)
  }
}
