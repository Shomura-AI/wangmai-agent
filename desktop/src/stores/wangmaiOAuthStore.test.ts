import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { startMock, statusMock, logoutMock, settingsFetchAllMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  statusMock: vi.fn(),
  logoutMock: vi.fn(),
  settingsFetchAllMock: vi.fn(),
}))

vi.mock('../api/wangmaiOAuth', () => ({
  wangmaiOAuthApi: {
    start: startMock,
    status: statusMock,
    logout: logoutMock,
  },
}))

vi.mock('./settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ fetchAll: settingsFetchAllMock }),
  },
}))

import { useWangMaiOAuthStore } from './wangmaiOAuthStore'

const initialState = useWangMaiOAuthStore.getState()

describe('wangmaiOAuthStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    startMock.mockReset()
    statusMock.mockReset()
    logoutMock.mockReset()
    settingsFetchAllMock.mockReset()
    settingsFetchAllMock.mockResolvedValue(undefined)
    useWangMaiOAuthStore.setState({
      ...initialState,
      status: null,
      isPolling: false,
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    useWangMaiOAuthStore.getState().stopPolling()
    useWangMaiOAuthStore.setState(initialState)
    vi.useRealTimers()
  })

  it('login does not start polling until the browser launch succeeds', async () => {
    startMock.mockResolvedValue({
      authorizeUrl: 'http://localhost:3456/api/wangmai-oauth/callback',
      state: 'state-123',
    })

    const result = await useWangMaiOAuthStore.getState().login()

    expect(result.authorizeUrl).toContain('/api/wangmai-oauth/callback')
    expect(useWangMaiOAuthStore.getState().isPolling).toBe(false)
  })

  it('startPolling stops after the status becomes logged in', async () => {
    statusMock
      .mockResolvedValueOnce({ loggedIn: false })
      .mockResolvedValueOnce({
        loggedIn: true,
        expiresAt: Date.now() + 60_000,
        scopes: ['user:inference'],
        subscriptionType: 'max',
      })

    useWangMaiOAuthStore.getState().startPolling()
    expect(useWangMaiOAuthStore.getState().isPolling).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(useWangMaiOAuthStore.getState().isPolling).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(useWangMaiOAuthStore.getState().status).toMatchObject({
      loggedIn: true,
      subscriptionType: 'max',
    })
    expect(useWangMaiOAuthStore.getState().isPolling).toBe(false)
    expect(settingsFetchAllMock).toHaveBeenCalledTimes(1)
  })

  it('does not refresh model settings for a logged-out status check', async () => {
    statusMock.mockResolvedValue({ loggedIn: false })

    await useWangMaiOAuthStore.getState().fetchStatus()

    expect(settingsFetchAllMock).not.toHaveBeenCalled()
  })
})
