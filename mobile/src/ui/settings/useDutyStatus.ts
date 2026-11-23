import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import CCWangMaiDuty from '../../../modules/wangmai-duty'
import type { DutyState } from './deliveryModel'

/**
 * The Android background service's state while the settings screen is open;
 * `undefined` when this phone does not use it, `null` until first read. Battery
 * exemption changes in system settings, so it is re-read on return and on a timer.
 */
export function useDutyStatus(enabled: boolean): DutyState | null | undefined {
  const [state, setState] = useState<DutyState | null>(null)
  useEffect(() => {
    if (!enabled || !CCWangMaiDuty) return
    const module = CCWangMaiDuty
    const read = () => {
      try {
        setState(module.status())
      } catch {}
    }
    read()
    const timer = setInterval(read, 2000)
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') read()
    })
    return () => {
      clearInterval(timer)
      listener.remove()
    }
  }, [enabled])
  return enabled && CCWangMaiDuty ? state : undefined
}

export function requestBackgroundRunning() {
  CCWangMaiDuty?.requestIgnoreBatteryOptimizations()
}
