# Legitify

Trusted document exchange between institutions. Requesters send a document to the institution that issued it, an optional AI agent prepares it, the right staff member answers, and the outcome is provable. Anyone can check a registered credential for free.

Runs on BOT Chain (testnet 968, mainnet 677). Nothing is deployed yet: everything here runs locally.

## Layout

| Folder | What it is |
|---|---|
| `contracts/` | Foundry. `LegitifyRegistry` (credentials), `LegitifyPaymaster` (gas sponsorship), `AuditAnchor` (daily audit roots) |
| `api/` | Node + Hono. Request desk, agent triage, escalation, audit log, sponsorship policy |
| `web/` | Vue 3 + Vite + Tailwind. Landing pages, public verifier, request flow, staff inbox |

## Run it

```sh
# contracts (needs Foundry)
cd contracts && make deps && forge test

# api: copy .env.example to .env and fill in the secrets it lists
cd api && npm install && npm test && npm run dev

# web: copy .env.example to .env
cd web && npm install && npm run dev
```

`contracts/script/LocalSeed.s.sol` seeds a fictional institution on a local anvil chain.

## Rules that keep this trustworthy

- The registry decides authenticity. The agent never answers; only staff can.
- The agent reads a document only if the institution opted in and the requester consented.
- Public checks hash the file in the browser. The file is never uploaded.
- No personal data on-chain.
- Never commit a secret. Anything prefixed `VITE_` ships to the browser.

## License

See `LICENSE`.
