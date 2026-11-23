import { afterEach, describe, expect, test } from 'bun:test'

import { subprocessEnv } from './subprocessEnv.js'

const originalLocalAccessToken = process.env.WANGMAI_LOCAL_ACCESS_TOKEN
const originalScrubFlag = process.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB

afterEach(() => {
  if (originalLocalAccessToken === undefined) {
    delete process.env.WANGMAI_LOCAL_ACCESS_TOKEN
  } else {
    process.env.WANGMAI_LOCAL_ACCESS_TOKEN = originalLocalAccessToken
  }

  if (originalScrubFlag === undefined) {
    delete process.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB
  } else {
    process.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB = originalScrubFlag
  }
})

describe('subprocessEnv', () => {
  test('never exposes the desktop local access token to tool subprocesses', () => {
    process.env.WANGMAI_LOCAL_ACCESS_TOKEN = 'desktop-local-secret'
    delete process.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB

    const env = subprocessEnv()

    expect(env.WANGMAI_LOCAL_ACCESS_TOKEN).toBeUndefined()
    expect(process.env.WANGMAI_LOCAL_ACCESS_TOKEN).toBe('desktop-local-secret')
  })

  test('keeps the session collaboration token in-process only', () => {
    const original = process.env.WANGMAI_SESSION_COLLABORATION_TOKEN
    process.env.WANGMAI_SESSION_COLLABORATION_TOKEN = 'collaboration-secret'
    try {
      expect(subprocessEnv().WANGMAI_SESSION_COLLABORATION_TOKEN).toBeUndefined()
      expect(process.env.WANGMAI_SESSION_COLLABORATION_TOKEN).toBe('collaboration-secret')
    } finally {
      if (original === undefined) delete process.env.WANGMAI_SESSION_COLLABORATION_TOKEN
      else process.env.WANGMAI_SESSION_COLLABORATION_TOKEN = original
    }
  })
})
