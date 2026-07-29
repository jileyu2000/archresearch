interface ResponsesProviderOptions {
  apiKey: string
  baseUrl: string
  model: string
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
  fetch?: typeof fetch
}

interface StructuredRequest {
  schemaName: string
  schema: Record<string, unknown>
  instructions: string
  input: string
  maximumOutputTokens: number
  tools?: Array<Record<string, unknown>>
  fixedToolCostUsd?: number
}

interface ResponsesPayload {
  output_text?: unknown
  output?: Array<{
    type?: unknown
    content?: Array<{
      type?: unknown
      text?: unknown
    }>
  }>
  usage?: {
    input_tokens?: unknown
    output_tokens?: unknown
  }
}

function extractOutputText(payload: ResponsesPayload) {
  if (typeof payload.output_text === 'string') return payload.output_text
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }
  throw new Error('Provider returned no structured output.')
}

function tokenCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export class ResponsesProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly inputUsdPerMillionTokens: number
  private readonly outputUsdPerMillionTokens: number
  private readonly fetch: typeof fetch

  constructor(options: ResponsesProviderOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.model = options.model
    this.inputUsdPerMillionTokens = options.inputUsdPerMillionTokens
    this.outputUsdPerMillionTokens = options.outputUsdPerMillionTokens
    this.fetch = options.fetch ?? globalThis.fetch
  }

  async generateStructured<T>(request: StructuredRequest) {
    const response = await this.fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        reasoning: { effort: 'medium' },
        instructions: request.instructions,
        input: request.input,
        max_output_tokens: request.maximumOutputTokens,
        ...(request.tools ? { tools: request.tools } : {}),
        text: {
          format: {
            type: 'json_schema',
            name: request.schemaName,
            strict: true,
            schema: request.schema,
          },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) {
      throw new Error(`Provider request failed with status ${response.status}.`)
    }

    const payload = await response.json() as ResponsesPayload
    let data: T
    try {
      data = JSON.parse(extractOutputText(payload)) as T
    } catch (error) {
      throw new Error('Provider returned invalid structured output.', { cause: error })
    }

    const inputTokens = tokenCount(payload.usage?.input_tokens)
    const outputTokens = tokenCount(payload.usage?.output_tokens)
    const costUsd = (
      inputTokens * this.inputUsdPerMillionTokens
      + outputTokens * this.outputUsdPerMillionTokens
    ) / 1_000_000 + (request.fixedToolCostUsd ?? 0)

    return {
      data,
      usage: { inputTokens, outputTokens },
      costUsd,
    }
  }
}
