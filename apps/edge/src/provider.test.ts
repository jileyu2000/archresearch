import { describe, expect, it, vi } from 'vitest'

import { ResponsesProvider } from './provider'

describe('server-only Responses provider', () => {
  it('requests strict JSON and accounts for token usage without returning the API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: JSON.stringify({ summary: '以剖面距离分开开放与安静空间。' }),
        }],
      }],
      usage: {
        input_tokens: 1200,
        output_tokens: 200,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const provider = new ResponsesProvider({
      apiKey: 'owner-provider-secret',
      baseUrl: 'https://provider.example/v1',
      model: 'gpt-5.6-sol',
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 8,
      fetch: fetchMock,
    })

    const response = await provider.generateStructured<{ summary: string }>({
      schemaName: 'research_summary',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
      instructions: '只根据给定证据总结。',
      input: '逐字证据：Reading rooms step away from the atrium.',
      maximumOutputTokens: 500,
    })

    expect(response.data).toEqual({ summary: '以剖面距离分开开放与安静空间。' })
    expect(response.costUsd).toBeCloseTo(0.004)
    expect(JSON.stringify(response)).not.toContain('owner-provider-secret')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer owner-provider-secret',
        }),
      }),
    )
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      text: { format: { type: string; strict: boolean } }
      max_output_tokens: number
    }
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true })
    expect(body.max_output_tokens).toBe(500)
  })

  it('fails closed on malformed output instead of synthesizing an ungrounded fallback', async () => {
    const provider = new ResponsesProvider({
      apiKey: 'owner-provider-secret',
      baseUrl: 'https://provider.example/v1',
      model: 'gpt-5.6-sol',
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 8,
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }],
      }), { status: 200 })),
    })

    await expect(provider.generateStructured({
      schemaName: 'invalid',
      schema: { type: 'object' },
      instructions: 'Return JSON.',
      input: 'Evidence',
      maximumOutputTokens: 100,
    })).rejects.toThrow('Provider returned invalid structured output.')
  })
})
