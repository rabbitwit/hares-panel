import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApi } from './core.js'
import {
  MAX_REQUEST_BYTES,
  createVercelConfig,
  sendWebResponse,
  toWebRequest,
} from './vercel.js'

export const vercelNodeConfig = { api: { bodyParser: false as const } }

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function handleVercelNode(request: IncomingMessage, response: ServerResponse) {
  try {
    const webRequest = await toWebRequest(request)
    const webResponse = await handleApi(webRequest, createVercelConfig(process.env))
    await sendWebResponse(response, webResponse)
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(response, 413, {
        error: 'too_large',
        message: `请求体不能超过 ${Math.round(MAX_REQUEST_BYTES / 1024 / 1024)} MB`,
      })
      return
    }
    console.error('[hares-nav] Vercel function error', error)
    sendJson(response, 500, { error: 'internal_error', message: '服务器处理请求时出错' })
  }
}
