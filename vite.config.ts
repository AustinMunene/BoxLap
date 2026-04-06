import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Ensure server-side code (dev API middleware) can read non-VITE env vars
  // like ANTHROPIC_API_KEY from `.env.local`.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
  plugins: [
    vue(),
    /**
     * Dev-only middleware that runs Vercel-style handlers under `/api/*`.
     *
     * Why: `vite --host` serves the SPA but does not execute the `api/*.ts`
     * serverless functions. The frontend fetches `/api/...` endpoints for Claude,
     * so without this middleware local dev always fails.
     *
     * This middleware:
     * - maps `/api/foo` -> `api/foo.ts`
     * - parses JSON request bodies
     * - provides a minimal `res.status().json()` API
     *
     * Production builds on Vercel ignore this and run the real serverless functions.
     */
    {
      name: 'pitwall-vercel-api-dev',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          try {
            // Re-load env on each request so dev API endpoints always see updated `.env.local`.
            Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

            const url = req.url || ''
            if (!url.startsWith('/api/')) return next()

            const endpoint = url.split('?')[0].replace('/api/', '')
            const filePath = path.resolve(process.cwd(), 'api', `${endpoint}.ts`)

            // Dynamic import so edits to api files reflect without restarting Vite.
            const modUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`
            const mod = await import(modUrl)
            const handler = mod?.default
            if (typeof handler !== 'function') {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'API endpoint not found' }))
              return
            }

            // Parse JSON body for POST/PUT/PATCH to emulate Vercel's req.body.
            const method = (req.method || 'GET').toUpperCase()
            let body: unknown = undefined
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
              body = await new Promise((resolve) => {
                let raw = ''
                req.on('data', (c) => (raw += c))
                req.on('end', () => {
                  if (!raw) return resolve(undefined)
                  try {
                    resolve(JSON.parse(raw))
                  } catch {
                    resolve(undefined)
                  }
                })
              })
            }

            const vercelReq = Object.assign(req, { body })

            const vercelRes = Object.assign(res, {
              status(code: number) {
                res.statusCode = code
                return vercelRes
              },
              json(obj: unknown) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(obj))
                return vercelRes
              },
            })

            await handler(vercelReq, vercelRes)
          } catch (e) {
            // Dev-only: log the real error so we can debug endpoint wiring.
            console.error('[pitwall-vercel-api-dev] middleware error', e)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Dev API middleware error' }))
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
  }
})
