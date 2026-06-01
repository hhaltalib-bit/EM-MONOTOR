// NOTE: In-memory rate limiting resets on each serverless cold start.
// This provides basic protection but is not persistent across function instances.
const attempts = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1 }
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: maxAttempts - entry.count }
}
