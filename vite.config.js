import path from 'node:path'
import mkcert from 'vite-plugin-mkcert'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

export default defineConfig({
  plugins: [
    mkcert(),
    plistPlugin(),
  ],
  server: {
    https: true
  }
})

function plistPlugin() {
  return {
    name: 'plist-plugin',
    configureServer(server) {
      server.middlewares.use('/plist', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')

        const url = new URL(req.url, `http://${req.headers.host}`)
        const r = url.searchParams.get('r')
        const d = url.searchParams.get('d')

        // ?r=<url> - proxy
        if (r) {
          try {
            const response = await fetch(r)
            res.writeHead(response.status, {
              'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
            })
            response.body?.pipe(res)
          } catch {
            res.writeHead(500)
            res.end('Fetch error')
          }
          return
        }

        // ?d=<base64> - plist
        if (d) {
          try {
            const X = JSON.parse(Buffer.from(d, 'base64').toString('utf-8'))

            if (X.u) {
              res.writeHead(200, { 'Content-Type': 'application/xml' })
              res.end(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict>
<key>kind</key><string>software-package</string>
<key>url</key><string>${X.u}</string>
</dict><dict>
<key>kind</key><string>display-image</string>
<key>needs-shine</key><false/>
<key>url</key><string>${X.i}</string>
</dict></array><key>metadata</key><dict>
<key>bundle-identifier</key><string>${X.b}</string>
<key>bundle-version</key><string>${X.v}</string>
<key>kind</key><string>software</string>
<key>title</key><string>${X.n}</string>
</dict></dict></array></dict></plist>`)
            } else {
              res.writeHead(400)
              res.end('Parsing error.')
            }
          } catch {
            res.writeHead(400)
            res.end('Parsing error.')
          }
          return
        }

        res.writeHead(400)
        res.end('Error.')
      })
    },
  }
}
