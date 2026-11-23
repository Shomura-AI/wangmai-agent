import { afterEach, expect, test } from 'bun:test'
import { registerScheduleDesktopSkill } from './scheduleDesktop.js'
import { getBundledSkills } from '../bundledSkills.js'
import { setAgentProfile, getAgentProfile } from '../../utils/agentProfile.js'

const keys = ['WANGMAI_DESKTOP_SERVER_URL', 'WANGMAI_SESSION_COLLABORATION_TOKEN', 'WANGMAI_SESSION_ID'] as const
const originals = keys.map(key => process.env[key])
const profile = getAgentProfile()
afterEach(() => {
  keys.forEach((key, index) => { if (originals[index] === undefined) delete process.env[key]; else process.env[key] = originals[index] })
  setAgentProfile(profile)
})

test('the local schedule skill resolves task and result requests through the desktop tool and respects availability', async () => {
  process.env.WANGMAI_DESKTOP_SERVER_URL = 'http://127.0.0.1:12345'
  process.env.WANGMAI_SESSION_COLLABORATION_TOKEN = 'fixture-token'
  process.env.WANGMAI_SESSION_ID = 'fixture-session'
  setAgentProfile('standard')
  registerScheduleDesktopSkill()
  const skill = getBundledSkills().find(command => command.name === 'schedule')!
  expect(skill.isEnabled()).toBe(true)
  expect(skill.type).toBe('prompt')
  if (skill.type !== 'prompt') throw new Error('expected prompt skill')
  expect(skill.allowedTools).toEqual(['ScheduledTask'])
  const prompt = await skill.getPromptForCommand('Show the last run result', {} as never)
  expect(prompt[0]).toMatchObject({ type: 'text' })
  expect(JSON.stringify(prompt)).toContain('Show the last run result')
  setAgentProfile('lean')
  expect(skill.isEnabled()).toBe(false)
})
