import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { startMock, statusMock, logoutMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  statusMock: vi.fn(),
  logoutMock: vi.fn(),
}))

vi.mock('../api/wangmaiOpenAIOAuth', () => ({
  wangmaiOpenAIOAuthApi: {
    start: startMock,
    status: statusMock,
    logout: logoutMock,
  },
}))

import { useWangMaiOpenAIOAuthStore } from './wangmaiOpenAIOAuthStore'

const initialState = useWangMaiOpenAIOAuthStore.getState()

describe('wangmaiOpenAIOAuthStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    startMock.mockReset()
    statusMock.mockReset()
    logoutMock.mockReset()
    useWangMaiOpenAIOAuthStore.setState({
      ...initialState,
      status: null,
      isPolling: false,
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    useWangMaiOpenAIOAuthStore.getState().stopPolling()
    useWangMaiOpenAIOAuthStore.setState(initialState)
    vi.useRealTimers()
  })

  it('login returns authorizeUrl without starting polling', async () => {
    startMock.mockResolvedValue({
      authorizeUrl: 'http://localhost:3456/callback/openai?state=openai-state',
      state: 'openai-state',
    })

    const result = await useWangMaiOpenAIOAuthStore.getState().login()

    expect(result.authorizeUrl).toContain('/callback/openai')
    expect(useWangMaiOpenAIOAuthStore.getState().isPolling).toBe(false)
  })

  it('startPolling stops after OpenAI OAuth status becomes logged in', async () => {
    statusMock
      .mockResolvedValueOnce({ loggedIn: false })
      .mockResolvedValueOnce({
        loggedIn: true,
        expiresAt: Date.now() + 60_000,
        email: 'user@example.com',
        accountId: 'acct_123',
      })

    useWangMaiOpenAIOAuthStore.getState().startPolling()
    expect(useWangMaiOpenAIOAuthStore.getState().isPolling).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(useWangMaiOpenAIOAuthStore.getState().isPolling).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(useWangMaiOpenAIOAuthStore.getState().status).toMatchObject({
      loggedIn: true,
      email: 'user@example.com',
      accountId: 'acct_123',
    })
    expect(useWangMaiOpenAIOAuthStore.getState().isPolling).toBe(false)
  })

  it('logout clears status and stops polling', async () => {
    logoutMock.mockResolvedValue({ ok: true })
    useWangMaiOpenAIOAuthStore.setState({
      status: {
        loggedIn: true,
        expiresAt: Date.now() + 60_000,
        email: 'user@example.com',
        accountId: 'acct_123',
      },
    })
    useWangMaiOpenAIOAuthStore.getState().startPolling()

    await useWangMaiOpenAIOAuthStore.getState().logout()

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(useWangMaiOpenAIOAuthStore.getState().status).toEqual({ loggedIn: false })
    expect(useWangMaiOpenAIOAuthStore.getState().isPolling).toBe(false)
  })

  it('preserves the signed-in account during a transient refresh error and clears the error after retry', async () => {
    const status = { loggedIn: true as const, expiresAt: 1, email: 'user@example.com', accountId: 'acct_123' }
    useWangMaiOpenAIOAuthStore.setState({ status })
    statusMock.mockRejectedValueOnce(new Error('Unable to verify OpenAI sign-in status right now. Please retry.'))
      .mockResolvedValueOnce({ ...status, expiresAt: 100_000 })
    await useWangMaiOpenAIOAuthStore.getState().fetchStatus()
    expect(useWangMaiOpenAIOAuthStore.getState().status).toEqual(status)
    expect(useWangMaiOpenAIOAuthStore.getState().error).toContain('Please retry')
    await useWangMaiOpenAIOAuthStore.getState().fetchStatus()
    expect(useWangMaiOpenAIOAuthStore.getState().status).toMatchObject({ loggedIn: true, expiresAt: 100_000 })
    expect(useWangMaiOpenAIOAuthStore.getState().error).toBeNull()
  })

  it('keeps first-load refresh failure unknown instead of treating it as signed out', async () => {
    statusMock.mockRejectedValueOnce(new Error('Please retry'))
    await useWangMaiOpenAIOAuthStore.getState().fetchStatus()
    expect(useWangMaiOpenAIOAuthStore.getState().status).toBeNull()
    expect(useWangMaiOpenAIOAuthStore.getState().error).toBe('Please retry')
  })
})
