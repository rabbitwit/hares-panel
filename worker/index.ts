import { handleApi } from '../server/core'
import { createApiConfig, type EnvLike } from '../server/cloudflare'

export default {
  async fetch(request: Request, env: EnvLike): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, createApiConfig(env))
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }
    return new Response('Hares-Panel: static assets binding is not configured.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  },
}
