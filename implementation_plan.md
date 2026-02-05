# RingCentral Auth & Optimization Plan

Address reported 400/403 errors and optimize polling using a dedicated Token Manager and Server-Sent Events (SSE).

## Proposed Changes

### [Backend] [server.js](file:///c:/Users/bbard/.gemini/antigravity/playground/tensor-corona/server.js)
1.  **Implement `RingCentralManager` Class**:
    -   Encapsulate SDK initialization and authentication.
    -   Implement robust `initialize()` with try/catch logic for `OAU-251` errors.
    -   Add automatic re-authentication using JWT if token refresh fails.
2.  **Implement Server-Sent Events (SSE)**:
    -   Add `/api/telephony/events` endpoint.
    -   Update `processTelephonyEvent` to broadcast events to connected SSE clients (frontend) instead of just updating memory.
    -   Replace the global `USER_CALLS` map with a real-time broadcast system (or keep it as state cache).

### [Frontend] [App.tsx](file:///c:/Users/bbard/.gemini/antigravity/playground/tensor-corona/App.tsx)
1.  **Replace Polling with SSE**:
    -   Remove `setInterval` for `/api/telephony/active-call`.
    -   Implement `EventSource` to listen to `/api/telephony/events`.
    -   Trigger "Screen Pop" on receiving `call-ringing` event from SSE.

## Verification Plan
### Automated Information
-   Check server logs for `RingCentral Authenticated` message (indicating successful custom Auth flow).
-   Verify no 400 loop errors in console.

### Manual Verification
-   Simulate a call using the existing Simulator.
-   Verify "Screen Pop" still appears instantly (push) instead of waiting for poll (pull).
-   Verify `Recieved SSE event` logs in browser console.
