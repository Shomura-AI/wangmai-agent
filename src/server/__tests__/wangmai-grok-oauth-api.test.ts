import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { handleWangMaiGrokOAuthApi } from '../api/wangmai-grok-oauth.js'
import { wangmaiGrokOAuthService } from '../services/wangmaiGrokOAuthService.js'

let tempDir: string
let previousConfigDir: string | undefined

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wangmai-grok-oauth-api-'))
  previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = tempDir
})

afterEach(async () => {
  wangmaiGrokOAuthService.dispose()
  if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = previousConfigDir
  await fs.rm(tempDir, { recursive: true, force: true })
})

describe('WangMai Grok OAuth API', () => {
  test('serves a clear local success page after browser authorization', async () => {
    const response = await handleWangMaiGrokOAuthApi(
      new Request('http://localhost/api/wangmai-grok-oauth/success'),
      new URL('http://localhost/api/wangmai-grok-oauth/success'),
      ['api', 'wangmai-grok-oauth', 'success'],
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('Grok Login Successful')
  })

  test('returns status without exposing token material and logs out', async () => {
    await wangmaiGrokOAuthService.saveTokens({
      accessToken: 'secret-access',
      refreshToken: 'secret-refresh',
      expiresAt: Date.now() + 3600_000,
      email: 'user@example.com',
    })
    const statusResponse = await handleWangMaiGrokOAuthApi(
      new Request('http://localhost/api/wangmai-grok-oauth'),
      new URL('http://localhost/api/wangmai-grok-oauth'),
      ['api', 'wangmai-grok-oauth'],
    )
    const statusText = await statusResponse.text()
    expect(statusText).toContain('user@example.com')
    expect(statusText).not.toContain('secret-access')
    expect(statusText).not.toContain('secret-refresh')

    const logoutResponse = await handleWangMaiGrokOAuthApi(
      new Request('http://localhost/api/wangmai-grok-oauth', { method: 'DELETE' }),
      new URL('http://localhost/api/wangmai-grok-oauth'),
      ['api', 'wangmai-grok-oauth'],
    )
    expect(logoutResponse.status).toBe(200)
    await expect(wangmaiGrokOAuthService.loadTokens()).resolves.toBeNull()
  })
})
