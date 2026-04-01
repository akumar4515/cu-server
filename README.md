# cu-server

WebRTC signaling + automatic device discovery backend.

## Environment
Copy `.env.example` to `.env` and configure:

- `PORT`: Server port (Render sets this automatically)
- `CLIENT_ORIGIN`: Allowed origin for CORS (`*` for open local testing)
- `PUBLIC_SERVER_URL`: Public backend URL (Render URL)

## Run
```bash
npm install
npm run dev
```

## Socket Events
- `sender:register`
- `sender:stream-status`
- `viewer:get-devices`
- `viewer:watch-device`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`
