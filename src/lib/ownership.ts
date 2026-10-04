// Web Locks protects all runs on this origin, including paused runs.
let releaseLock: (() => void) | undefined;
export async function acquireOwner(): Promise<boolean> {
  if (releaseLock) return true;
  if (!navigator.locks)
    throw new Error(
      "مرورگر از Web Locks پشتیبانی نمی‌کند. اجرا برای جلوگیری از تداخل زبانه‌ها غیرفعال است؛ از Chrome، Edge یا Firefox جدید روی localhost استفاده کن.",
    );
  return new Promise<boolean>((resolve, reject) => {
    navigator.locks
      .request("flow-studio-execution", { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }
        await new Promise<void>((release) => {
          releaseLock = release;
          resolve(true);
        });
      })
      .catch(reject);
  });
}
export function releaseOwner() {
  releaseLock?.();
  releaseLock = undefined;
}
