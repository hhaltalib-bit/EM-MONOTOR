type LogLevel = 'info' | 'warn' | 'error'

function emit(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    context,
    message,
    ...(meta ?? {}),
    timestamp: new Date().toISOString(),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  info:  (context: string, message: string, meta?: Record<string, unknown>) => emit('info',  context, message, meta),
  warn:  (context: string, message: string, meta?: Record<string, unknown>) => emit('warn',  context, message, meta),
  error: (context: string, message: string, meta?: Record<string, unknown>) => emit('error', context, message, meta),
}
