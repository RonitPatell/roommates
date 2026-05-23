/** Reject if a promise does not settle within `ms` milliseconds. */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  const settled = Promise.resolve(promise);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    settled
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Run async work on the next tick (never block Supabase auth callbacks). */
export function deferAsync(work: () => Promise<void>): void {
  setTimeout(() => {
    work().catch(() => {});
  }, 0);
}
