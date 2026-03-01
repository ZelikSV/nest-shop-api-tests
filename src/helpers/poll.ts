export async function waitFor<T>(
  fn: () => Promise<T>,
  check: (value: T) => boolean,
  options: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const timeout = options.timeout ?? 8000
  const interval = options.interval ?? 500
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const result = await fn()
    if (check(result)) return result
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`waitFor timed out after ${timeout}ms`)
}
