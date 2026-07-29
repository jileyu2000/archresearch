interface WorkerRouteDependencies {
  assets: Pick<Fetcher, 'fetch'>
  api(request: Request): Promise<Response>
}

export function withSecurityHeaders(response: Response) {
  const next = new Response(response.body, response)
  next.headers.set('x-content-type-options', 'nosniff')
  next.headers.set('referrer-policy', 'no-referrer')
  next.headers.set('x-frame-options', 'DENY')
  next.headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
  next.headers.set(
    'content-security-policy',
    [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "connect-src 'self' https://challenges.cloudflare.com",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  )
  return next
}

export function createWorkerRouteHandler(dependencies: WorkerRouteDependencies) {
  return async (request: Request) => {
    const url = new URL(request.url)
    const response = url.pathname.startsWith('/api/')
      ? await dependencies.api(request)
      : await dependencies.assets.fetch(request)
    return withSecurityHeaders(response)
  }
}
