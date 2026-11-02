import { getStore } from '@edgeone/pages-blob'
import { handleApi } from './core'
import {
  createEdgeOneConfig,
  type EdgeOneBlobStore,
  type EdgeOneEnv,
} from './edgeone'

interface EdgeOneContext {
  request: Request
  env?: Record<string, string | undefined>
}

const DEFAULT_STORE_NAME = 'hares-panel'

let cachedStore: EdgeOneBlobStore | null = null
let cachedStoreName = ''

function resolveStore(env: EdgeOneEnv): EdgeOneBlobStore {
  const name = env.HARES_BLOB_STORE?.trim() || DEFAULT_STORE_NAME
  if (!cachedStore || cachedStoreName !== name) {
    // The SDK expects { name, projectId, token } only for external callers; in
    // EdgeOne Functions the deploy credential is injected automatically, so
    // the string form is the supported in-function API.
    cachedStore = getStore(name) as unknown as EdgeOneBlobStore
    cachedStoreName = name
  }
  return cachedStore
}

function readEnv(context: EdgeOneContext): EdgeOneEnv {
  const processEnv = typeof process !== 'undefined' ? process.env : {}
  return {
    ...processEnv,
    ...(context.env ?? {}),
  } as EdgeOneEnv
}

/**
 * EdgeOne's Node Functions receive a Request-like object whose body may be a
 * Node Readable rather than a Web ReadableStream. The shared core reads bodies
 * through `request.body.getReader()`, so normalize it to a standard Request
 * before handing it over. This keeps JSON writes and multipart uploads working.
 */
async function normalizeRequest(request: Request): Promise<Request> {
  const method = (request.method || 'GET').toUpperCase()
  const body = request.body as unknown
  if (!body || typeof (body as ReadableStream).getReader === 'function') return request

  let bytes: Uint8Array<ArrayBuffer> | undefined
  if (typeof body === 'string') {
    bytes = new TextEncoder().encode(body)
  } else if (body instanceof Uint8Array) {
    bytes = new Uint8Array(body)
  } else if (body instanceof ArrayBuffer) {
    bytes = new Uint8Array(body)
  } else if (typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = []
    let total = 0
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
      total += chunk.byteLength
    }
    bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
  } else if (typeof request.arrayBuffer === 'function') {
    bytes = new Uint8Array(await request.arrayBuffer())
  } else {
    return request
  }

  const init: RequestInit = {
    method,
    headers: request.headers,
    signal: request.signal,
  }
  if (method !== 'GET' && method !== 'HEAD' && bytes && bytes.byteLength > 0) {
    init.body = bytes
  }
  return new Request(request.url, init)
}

export async function onRequest(context: EdgeOneContext): Promise<Response> {
  const env = readEnv(context)
  let store: EdgeOneBlobStore | null = null
  try {
    store = resolveStore(env)
  } catch (error) {
    console.error('[hares-nav] EdgeOne Blob store is unavailable', error)
  }

  try {
    const request = await normalizeRequest(context.request)
    return await handleApi(request, createEdgeOneConfig(store, env))
  } catch (error) {
    console.error('[hares-nav] EdgeOne function error', error)
    return new Response(
      JSON.stringify({ error: 'internal_error', message: '服务器处理请求时出错' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      },
    )
  }
}
