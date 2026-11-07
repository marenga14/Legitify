# Legitfy

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

### Local end-to-end stack

`scripts/local-up.sh` starts anvil on port 8546, deploys and seeds the contracts, writes sample PDFs to `.local/samples/`, and fills `api/.env` and `web/.env`. Re-running it keeps your data; `--reset` starts from nothing. It uses anvil's public test keys, so never point it at a real network.

| Anvil account | Role |
|---|---|
| 0 | Platform admin |
| 1 | Admin, Kilimani University |
| 2 | Operator, Kilimani, through a smart account (can't publish) |
| 3 | Operator, Kilimani, direct wallet |
| 4 | Admin, Pwani College |

To use your own wallets, create a root `.env.local` with `LOCAL_PLATFORM_WALLET=0x...` and `LOCAL_ADMIN_WALLET=0x...` (Kilimani admin), then re-run the script. Each is funded with 100 local ETH and replaces the seeded account in that role.

## Joining and network details

Institutions apply at `/apply` with their registration document and a wallet they prove they hold. They then download a pre-filled letter of mandate, have their head sign and seal it, and upload it from their tracking link. The platform admin reviews applications in the console, and approving registers the institution on-chain from the admin's wallet. Registered names can't be changed or deleted.

After deployment, the platform admin sets the network name, chain ID, RPC URL, explorer and registry address under Settings. Saving checks that the RPC answers on that chain and that the admin owns the registry. Public pages show BOT Chain mainnet details while the app runs on a development chain.

## Languages

The web app ships in English, Kiswahili and Simplified Chinese. English is the source in `web/src/locales/en.ts`, and `sw.ts` and `zh.ts` must match it key for key. API messages stay in English and are translated in `web/src/locales/server.ts`. `npm test` in `web/` fails if a key, a placeholder or an API message is missing.

## Rules that keep this trustworthy

- The registry decides authenticity. The agent never answers; only staff can.
- The agent reads a document only if the institution opted in and the requester consented.
- Public checks hash the file in the browser. The file is never uploaded.
- No personal data on-chain.
- Never commit a secret. Anything prefixed `VITE_` ships to the browser.

## License

See `LICENSE`.
