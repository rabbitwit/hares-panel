import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApi } from '../server/core.js'
import {
  MAX_REQUEST_BYTES,
  createVercelConfig,
  sendWebResponse,
  toWebRequest,
} from '../server/vercel.js'

// Keep the raw body so multipart image uploads reach the shared handler.
export const config = { api: { bodyParser: false } }

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
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
