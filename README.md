# RingCentral Incoming Call Handler

This repo contains a basic scaffold for a RingCentral Incoming Call Handler application.

- Backend: Node.js + Express (receives RingCentral webhooks at `/webhook`)
- Frontend: Vite + React (TypeScript) client in `/client` for Screen Pop UI

Quick start

1. Install dependencies (root and client):

```bash
cd rc-incoming-handler
npm install
cd client
npm install
```

2. Start both server and client (from repo root):

```bash
npm run dev
```

3. Configure RingCentral webhook to point to `https://<your-host>/webhook` and use the received events.

Next steps

- Add caller ID lookup (simple in-memory or DB) in the backend.
- Persist recent calls and build the Active Call dashboard in the client.
- Secure webhook validation using RingCentral's verification token.
