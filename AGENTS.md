# Flow Studio

- Persian RTL interface; code, paths and JSON remain LTR.
- React/Vite static frontend only. No server, secrets, proxy, runtime AI calls or background processing.
- `npm ci`, `npm run dev` (localhost:4173), `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.
- Node >=22.12. Engine and data behavior live in src/lib, independent of React. Never advance before a committed checkpoint.
- Keep fixture requests visibly distinct from live requests. Preserve explicit recovery and uncertain-write confirmation.
- Run relevant meaningful tests after changes. Do not push or deploy without an explicit request.
