import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { startMock, statusMock, logoutMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  statusMock: vi.fn(),
  logoutMock: vi.fn(),
}))

vi.mock('../api/wangmaiDeepSeekOAuth', () => ({
  wangmaiDeepSeekOAuthApi: {
    start: startMock,
    status: statusMock,
    logout: logoutMock,
  },
}))

import { useWangMaiDeepSeekOAuthStore } from './wangmaiDeepSeekOAuthStore'
import { useSettingsStore } from './settingsStore'

const initialState = useWangMaiDeepSeekOAuthStore.getState()

describe('wangmaiDeepSeekOAuthStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    startMock.mockReset()
    statusMock.mockReset()
    logoutMock.mockReset()
    useSettingsStore.setState({ locale: 'en' })
    useWangMaiDeepSeekOAuthStore.setState({
      ...initialState,
      status: null,
      isPolling: false,
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    useWangMaiDeepSeekOAuthStore.getState().stopPolling()
    useWangMaiDeepSeekOAuthStore.setState(initialState)
    vi.useRealTimers()
  })

  it('returns the authorization URL, passes the UI locale and does not poll before the browser opens', async () => {
    useSettingsStore.setState({ locale: 'zh' })
    startMock.mockResolvedValue({
      authorizeUrl: 'https://platform.deepseek.com/oauth/authorize?state=ds-state',
      state: 'ds-state',
    })

    const result = await useWangMaiDeepSeekOAuthStore.getState().login()

    expect(result.authorizeUrl).toContain('state=ds-state')
    expect(startMock).toHaveBeenCalledWith('zh')
    expect(useWangMaiDeepSeekOAuthStore.getState().isPolling).toBe(false)
  })

  it('keeps the request error and rethrows when starting the login fails', async () => {
    startMock.mockRejectedValue(new Error('server unavailable'))

    await expect(useWangMaiDeepSeekOAuthStore.getState().login()).rejects.toThrow('server unavailable')

    expect(useWangMaiDeepSeekOAuthStore.getState()).toMatchObject({
      isLoading: false,
      error: 'server unavailable',
    })
  })

  it('polls every two seconds and stops once the account is logged in', async () => {
    statusMock
      .mockResolvedValueOnce({ loggedIn: false })
      .mockResolvedValueOnce({ loggedIn: true, name: 'Ada', contact: 'a***@example.com' })

    useWangMaiDeepSeekOAuthStore.getState().startPolling()
    expect(useWangMaiDeepSeekOAuthStore.getState().isPolling).toBe(true)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(statusMock).toHaveBeenCalledTimes(1)
    expect(useWangMaiDeepSeekOAuthStore.getState().isPolling).toBe(true)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(useWangMaiDeepSeekOAuthStore.getState().status).toMatchObject({
      loggedIn: true,
      name: 'Ada',
      contact: 'a***@example.com',
    })
    expect(useWangMaiDeepSeekOAuthStore.getState().isPolling).toBe(false)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(statusMock).toHaveBeenCalledTimes(2)
  })

  it('clears the status and stops polling on logout', async () => {
    logoutMock.mockResolvedValue({ ok: true })
    useWangMaiDeepSeekOAuthStore.setState({
      status: { loggedIn: true, name: null, contact: null },
      isPolling: true,
    })

    await useWangMaiDeepSeekOAuthStore.getState().logout()

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(useWangMaiDeepSeekOAuthStore.getState()).toMatchObject({
      status: { loggedIn: false },
      isPolling: false,
      isLoading: false,
    })
  })
})
