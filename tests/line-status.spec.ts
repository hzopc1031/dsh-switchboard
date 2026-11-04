import { describe, expect, it } from 'vitest'
import { overviewRequest } from '../src/client/api.ts'
import { lineCardStatus } from '../src/client/line-status.ts'
import type { ChatSummary } from '../src/history-types.ts'
import { buildOverview, registerHistoryRoutes, type OverviewBody } from '../src/routes.ts'

const running = { id: 'feishu', type: 'feishu' as const, name: '飞书', state: { kind: 'running' as const, username: 'DSH Bot' }, queued: 0 }
const chat: ChatSummary = {
  chatId: 'feishu:oc_1', title: 'Team', type: 'private', lastAt: 1, lastText: 'hi', count: 1, deniedOnly: false,
}
const stats = {
  today: { in: 1, out: 1 },
  week: { messages: 2, activeChats: 1, allowed: 0, rejected: 0, denied: 0 },
  series: [{ day: '2026-11-04', in: 1, out: 1 }],
}

describe('line card status', () => {
  it('says off only when the switch is off', () => {
    expect(lineCardStatus(false, running.state)).toEqual({ kind: 'off' })
    expect(lineCardStatus(false, undefined)).toEqual({ kind: 'off' })
  })

  it('says unknown when an enabled line has no report yet', () => {
    expect(lineCardStatus(true, undefined)).toEqual({ kind: 'unknown' })
  })

  it('shows the report for an enabled line', () => {
    expect(lineCardStatus(true, running.state)).toEqual({ kind: 'state', state: running.state })
  })
})

describe('overview request', () => {
  it('is a GET with no body, so Desktop can forward it', () => {
    const { url, init } = overviewRequest()
    expect(url).toBe('api/switchboard/overview')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.cache).toBe('no-store')
  })
})

describe('overview route', () => {
  function mount(log: { chats: () => Promise<ChatSummary[]>; stats: () => Promise<typeof stats> }, modelOf: () => undefined = () => undefined) {
    const routes = new Map<string, { methods: readonly string[]; fetch: () => Promise<Response> }>()
    const ctx = {
      effect(register: () => void) { register() },
      connection: {
        fetch: {
          register(route: { path: string; methods: readonly string[]; fetch: () => Promise<Response> }) {
            routes.set(route.path, route)
            return () => {}
          },
        },
      },
    }
    const bridge = {
      state: { kind: 'running' as const, username: 'DSH Bot' },
      lineStates: () => [running],
      modelOf,
      isAllowedUser: () => false,
    }
    registerHistoryRoutes(ctx as never, log as never, bridge as never, async () => ({}), {} as never)
    const overview = routes.get('/api/switchboard/overview')
    if (overview === undefined) throw new Error('overview route was not registered')
    return overview
  }

  async function body(response: Response): Promise<OverviewBody> {
    expect(response.status).toBe(200)
    return await response.json() as OverviewBody
  }

  it('accepts GET and POST', () => {
    expect(mount({ chats: async () => [], stats: async () => stats }).methods).toEqual(['GET', 'POST'])
  })

  it('returns a running line when the chat index and the stats both throw', async () => {
    const overview = mount({
      chats: async () => { throw new Error('torn index.json') },
      stats: async () => { throw new Error('bad stats.json') },
    })
    const value = await body(await overview.fetch())
    expect(value.lines).toEqual([running])
    expect(value.state).toEqual({ kind: 'running', username: 'DSH Bot' })
    expect(value.chats).toEqual([])
    expect(value.chatsError).toBe(true)
    expect(value.stats).toBeUndefined()
  })

  it('keeps chats when only the stats read fails', async () => {
    const overview = mount({
      chats: async () => [chat],
      stats: async () => { throw new Error('bad stats.json') },
    })
    const value = await body(await overview.fetch())
    expect(value.lines).toEqual([running])
    expect(value.chats.map(item => item.chatId)).toEqual(['feishu:oc_1'])
    expect(value.chatsError).toBeUndefined()
    expect(value.stats).toBeUndefined()
  })

  it('returns stats when both reads succeed', async () => {
    const value = await buildOverview({
      state: { kind: 'running', username: 'DSH Bot' },
      lines: [running],
      readChats: async () => [chat],
      readStats: async () => stats,
      describe: item => item,
    })
    expect(value.stats?.series).toEqual(stats.series)
    expect(value.chatsError).toBeUndefined()
  })

  it('still returns line states when describing a chat throws', async () => {
    const value = await buildOverview({
      state: { kind: 'stopped' },
      lines: [running],
      readChats: async () => [{ ...chat, sessionId: 's1' }],
      readStats: async () => stats,
      describe: () => { throw new Error('model lookup failed') },
    })
    expect(value.lines).toEqual([running])
    expect(value.chatsError).toBe(true)
    expect(value.stats?.today).toEqual(stats.today)
  })
})
