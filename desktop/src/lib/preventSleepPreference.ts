export const PREVENT_SLEEP_STORAGE_KEY = 'wangmai-prevent-sleep-while-running'

export function readPreventSleepPreference(): boolean {
  try {
    return localStorage.getItem(PREVENT_SLEEP_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
