# WebDesk

A starter MVP for a website that displays a real remote desktop Chromium browser inside a responsive web interface.

## Requirements
- Windows 10/11, macOS, or Linux
- Node.js 20 or newer
- Internet connection
- A server capable of running Chromium for public deployment

## Run locally (Windows)
1. Install Node.js LTS from https://nodejs.org/
2. Extract this ZIP.
3. Open the `webdesk` folder in File Explorer.
4. Click the address bar, type `cmd`, and press Enter.
5. Run:

   ```bash
   npm install
   npx playwright install chromium
   npm start
   ```

6. Open http://localhost:3000 in Chrome or Edge.
7. Enter `https://web.whatsapp.com` and press Open website.

## Important MVP limitations
- This is an early prototype: remote pages are sent as frequently refreshed JPEG frames, with click and scroll input forwarded to Chromium. It is not yet a low-latency WebRTC/noVNC streaming product.
- Text entry, touch gestures, drag-and-drop, file upload/download, audio/video, multiple independent tabs, and reliable mobile keyboard support still need implementation.
- Some websites block automation, remote browsers, or embedded-like experiences. WhatsApp may change its compatibility requirements and may not work consistently.
- Browser sessions are in-memory and disappear when the server restarts.
- The sample server has a small session limit. Do not expose it publicly as-is.

## Before public deployment
Add authentication, per-user session ownership, rate limiting, strict network egress controls (including DNS rebinding protection), secure WebSocket origin checks, HTTPS, resource quotas, session timeouts, logging controls, and a hardened container. Add proper file transfer and interactive streaming. Use a paid/managed browser host if your VPS cannot run Chromium reliably.

## Environment variables
- `PORT` (default 3000)
- `MAX_SESSIONS` (default 5)

## Architecture
Browser UI (HTML/CSS/JS) → Express API → Playwright → headless desktop Chromium → JPEG frame stream over WebSocket.
