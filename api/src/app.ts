import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { sign, verify } from "hono/jwt";
import { recoverMessageAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import type { Triage, Triager } from "./agent.js";
import { appendAudit } from "./audit.js";
import type { Chain, MemberRole } from "./chain.js";
import { decryptFile, encryptFile, sha256Hex } from "./crypto.js";
import type { Db } from "./db.js";
import { dueAt, escalateForSla, routeAfterTriage } from "./escalation.js";
import { evaluateSponsorship } from "./sponsorship.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const SESSION_SECONDS = 3600;
const NONCE_SECONDS = 300;

export interface Deps {
  db: Db;
  chain: Chain;
  triager: Triager | null;
  sessionSecret: string;
  fileMasterKey: string;
  dataDir: string;
  webOrigin: string;
  registry: Address;
  dailySponsorQuota: number;
  /** Signs an approved UserOperation; absent until a paymaster is deployed. */
  signSponsorship?: (op: Record<string, unknown>) => Promise<{ paymasterAndData: Hex; validUntil: number }>;
}

interface Session {
  account: Address;
  institutionId: number;
  role: MemberRole;
  level: number;
}
const CredentialForm = z.object({
  credentialId: z.string().regex(/^0x[0-9a-f]{64}$/),
  ownerName: z.string().trim().min(2).max(200),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).default(""),
});
const ShareForm = z.object({
  recipient: z.string().trim().min(2).max(200),
  comment: z.string().trim().max(1000).default(""),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});
const MONTHS_SHOWN = 6;

/** Zero-filled monthly counts, so empty months still appear on the chart. */
function monthlySeries(rows: { month: string; n: number }[], now = new Date()) {
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.n)]));
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_SHOWN - 1 - i), 1));
    const month = d.toISOString().slice(0, 7);
    return { month, count: byMonth.get(month) ?? 0 };
  });
}
type Env = { Variables: { session: Session } };

const RequestForm = z.object({
  institutionId: z.coerce.number().int().positive(),
  requesterOrg: z.string().trim().min(2).max(200),
  requesterEmail: z.email().max(254),
  subject: z.string().trim().min(3).max(200),
  purpose: z.string().trim().min(3).max(2000),
  consentAgent: z.enum(["true", "false"]).transform((v) => v === "true"),
});

const Answer = z
  .object({
    outcome: z.enum(["confirmed", "not_confirmed", "needs_information"]),
    note: z.string().trim().max(2000).default(""),
  })
  .refine((a) => a.outcome === "confirmed" || a.note.length > 0, { message: "Explain this outcome in a note" });

/** Small per-process limiter for public writes. Put a real one at the edge in production. */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return async (c: Context, next: () => Promise<void>) => {
    const key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const now = Date.now();
    const hit = hits.get(key);
    if (!hit || hit.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++hit.n > max) return c.json({ error: "Too many requests. Try again later." }, 429);
    await next();
  };
}

export function createApp(deps: Deps) {
  const { db, chain } = deps;
  const app = new Hono<Env>();
  const fileDir = path.join(deps.dataDir, "files");
  const filePath = (id: string) => path.join(fileDir, `${id}.bin`);
  const uploadLimit = bodyLimit({ maxSize: MAX_FILE_BYTES + 64 * 1024, onError: (c) => c.json({ error: "Files can be up to 15 MB." }, 413) });
  const statusOf = async (fileSha: string) => {
    const match = await chain.verifyByHash(`0x${fileSha}`).catch(() => null);
    return match?.status === "not_found" || !match ? "pending" : match.status;
  };

  /** Platform owner only. Separate from `staff`, which requires institution membership. */
  const platform = async (c: Context<Env>, next: () => Promise<void>) => {
    const token = c.req.header("authorization")?.replace(/^Bearer /, "");
    if (!token) return c.json({ error: "Sign in first." }, 401);
    try {
      const sub = (await verify(token, deps.sessionSecret, "HS256")).sub as string;
      if (sub.toLowerCase() !== (await chain.platformOwner()).toLowerCase()) throw new Error("not owner");
    } catch {
      return c.json({ error: "Only the platform admin can do this." }, 403);
    }
    await next();
  };

  app.use("*", cors({ origin: deps.webOrigin, allowHeaders: ["authorization", "content-type"] }));

  const staff = async (c: Context<Env>, next: () => Promise<void>) => {
    const token = c.req.header("authorization")?.replace(/^Bearer /, "");
    if (!token) return c.json({ error: "Sign in first." }, 401);
    let account: Address;
    try {
      account = (await verify(token, deps.sessionSecret, "HS256")).sub as Address;
    } catch {
      return c.json({ error: "Session expired. Sign in again." }, 401);
    }
    // Chain is the source of truth, so removing someone takes effect on their next call.
    const member = await chain.getMember(account);
    if (member.role === "none") return c.json({ error: "This account no longer has access." }, 403);
    const row = await db.query<{ level: number }>("SELECT level FROM staff WHERE account = $1", [account]);
    const level = member.role === "admin" ? 3 : (row.rows[0]?.level ?? 1);
    c.set("session", { account, institutionId: member.institutionId, role: member.role, level });
    await next();
  };

  const ownRequest = async (id: string, institutionId: number) => {
    if (!z.uuid().safeParse(id).success) return null;
    const { rows } = await db.query<Record<string, any>>(
      "SELECT * FROM requests WHERE id = $1 AND institution_id = $2",
      [id, institutionId],
    );
    return rows[0] ?? null;
  };

  // ------------------------------------------------------------------ public

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/institutions", async (c) => {
    const { rows } = await db.query("SELECT id, name FROM institutions WHERE active ORDER BY name");
    return c.json(rows);
  });

  app.post(
    "/requests",
    rateLimit(10, 60_000),
    uploadLimit,
    async (c) => {
      const body = await c.req.parseBody();
      const form = RequestForm.safeParse(body);
      if (!form.success) return c.json({ error: "Check the form and try again.", issues: z.flattenError(form.error) }, 400);
      const file = body.file;
      if (!(file instanceof File)) return c.json({ error: "Attach the document as a PDF." }, 400);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length > MAX_FILE_BYTES) return c.json({ error: "Files can be up to 15 MB." }, 413);
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return c.json({ error: "Attach the document as a PDF." }, 400);

      const f = form.data;
      const inst = await db.query<{ name: string; agent_enabled: boolean }>(
        "SELECT name, agent_enabled FROM institutions WHERE id = $1 AND active",
        [f.institutionId],
      );
      const institution = inst.rows[0];
      if (!institution) return c.json({ error: "That institution isn't accepting requests." }, 404);

      const id = randomUUID();
      const trackingToken = randomBytes(24).toString("base64url");
      const fileSha = sha256Hex(bytes);
      await mkdir(fileDir, { recursive: true });
      await writeFile(filePath(id), encryptFile(deps.fileMasterKey, f.institutionId, id, bytes));

      // Hash lookup needs no consent: nothing leaves the service but a hash.
      const match = await chain.verifyByHash(`0x${fileSha}`).catch(() => null);
      const now = new Date();
      await db.query(
        `INSERT INTO requests (id, institution_id, requester_org, requester_email, subject, purpose, consent_agent,
           file_name, file_size, file_sha256, tracking_hash, due_at, registry_status, registry_institution)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, f.institutionId, f.requesterOrg, f.requesterEmail, f.subject, f.purpose, f.consentAgent,
         file.name.slice(0, 255), bytes.length, fileSha, sha256Hex(trackingToken), dueAt(1, now).toISOString(),
         match?.status ?? "unchecked", match?.institutionName ?? null],
      );
      await appendAudit(db, {
        requestId: id, institutionId: f.institutionId, actor: "requester", action: "request.received",
        detail: { fileSha, consentAgent: f.consentAgent },
      });

      if (deps.triager && institution.agent_enabled && f.consentAgent) {
        await runTriage(id, f.institutionId, bytes, f.subject, institution.name, match?.status ?? "unchecked");
      } else if (match) {
        await applyRouting(id, f.institutionId, 1, { riskLevel: "low", confidence: 1 }, match.status);
      }
      return c.json({ id, trackingToken }, 201);
    },
  );

  const applyRouting = async (
    id: string, institutionId: number, level: number,
    t: Pick<Triage, "riskLevel" | "confidence">, registryStatus: string,
  ) => {
    const routing = routeAfterTriage({
      level, risk: t.riskLevel, confidence: t.confidence,
      registryStatus: registryStatus === "suspended" || registryStatus === "revoked" ? registryStatus : "ok",
    });
    await db.query(
      `UPDATE requests SET level = $1, priority = $2, escalation_reason = COALESCE($3, escalation_reason),
         due_at = CASE WHEN $1::int > level THEN $4::timestamptz ELSE due_at END WHERE id = $5`,
      [routing.level, routing.priority, routing.reason, dueAt(routing.level, new Date()).toISOString(), id],
    );
    if (routing.reason) {
      await appendAudit(db, {
        requestId: id, institutionId, actor: "system", action: "request.escalated",
        detail: { level: routing.level, reason: routing.reason },
      });
    }
  };

  const runTriage = async (
    id: string, institutionId: number, bytes: Buffer, subject: string, institution: string, registryStatus: string,
  ) => {
    let triage: Triage | null = null;
    try {
      triage = await deps.triager!(bytes, { subject, institution });
    } catch (error) {
      console.error("triage failed", id, error);
    }
    if (!triage) {
      await db.query("UPDATE requests SET triage_status = 'unavailable' WHERE id = $1", [id]);
      await appendAudit(db, { requestId: id, institutionId, actor: "agent", action: "triage.unavailable" });
      return;
    }
    await db.query("UPDATE requests SET triage_status = 'done', triage = $1 WHERE id = $2", [JSON.stringify(triage), id]);
    await appendAudit(db, {
      requestId: id, institutionId, actor: "agent", action: "triage.done",
      detail: { risk: triage.riskLevel, confidence: triage.confidence },
    });
    await applyRouting(id, institutionId, 1, triage, registryStatus);
  };

  app.get("/requests/track/:token", async (c) => {
    const { rows } = await db.query<Record<string, any>>(
      `SELECT r.status, r.created_at, r.due_at, r.answer_outcome, r.answer_note, r.answered_at, r.receipt_hash,
              r.subject, i.name AS institution
       FROM requests r JOIN institutions i ON i.id = r.institution_id WHERE r.tracking_hash = $1`,
      [sha256Hex(c.req.param("token"))],
    );
    const r = rows[0];
    if (!r) return c.json({ error: "No request matches this link." }, 404);
    return c.json({
      subject: r.subject, institution: r.institution, status: r.status, submittedAt: r.created_at, dueAt: r.due_at,
      outcome: r.answer_outcome, note: r.answer_note, answeredAt: r.answered_at, receipt: r.receipt_hash,
    });
  });

  // -------------------------------------------------------------------- auth

  app.post("/auth/challenge", rateLimit(30, 60_000), async (c) => {
    const nonce = randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + NONCE_SECONDS * 1000);
    await db.query("INSERT INTO login_nonces (nonce, expires_at) VALUES ($1, $2)", [nonce, expires.toISOString()]);
    return c.json({ nonce, message: `Sign in to Legitify\nNonce: ${nonce}` });
  });

  app.post("/auth/login", rateLimit(30, 60_000), async (c) => {
    const body = z
      .object({ nonce: z.string().regex(/^[0-9a-f]{32}$/), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Sign-in request was malformed." }, 400);
    const used = await db.query("DELETE FROM login_nonces WHERE nonce = $1 AND expires_at > now() RETURNING nonce", [body.data.nonce]);
    if (used.rows.length === 0) return c.json({ error: "Sign-in expired. Try again." }, 401);

    const owner = await recoverMessageAddress({
      message: `Sign in to Legitify\nNonce: ${body.data.nonce}`,
      signature: body.data.signature as Hex,
    });
    const sign_ = (sub: Address) =>
      sign({ sub, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }, deps.sessionSecret, "HS256");
    if (owner.toLowerCase() === (await chain.platformOwner()).toLowerCase()) {
      return c.json({ token: await sign_(owner), account: owner, owner, role: "platform", mode: "eoa" });
    }
    // A wallet can be a member itself (e.g. a hardware-wallet admin) or own a smart account.
    // SimpleAccount has no ERC-1271, so identity is the owner key plus the account it derives.
    const direct = await chain.getMember(owner);
    const mode = direct.role === "none" ? "smart" : "eoa";
    const account = mode === "eoa" ? owner : await chain.accountOf(owner);
    const member = mode === "eoa" ? direct : await chain.getMember(account);
    if (member.role === "none") return c.json({ error: "This wallet isn't part of an institution yet.", account }, 403);
    await db.query(
      "INSERT INTO staff (account, institution_id) VALUES ($1, $2) ON CONFLICT (account) DO UPDATE SET institution_id = $2",
      [account, member.institutionId],
    );
    return c.json({ token: await sign_(account), account, owner, institutionId: member.institutionId, role: member.role, mode });
  });

  // ------------------------------------------------------------------- staff

  app.get("/me", staff, async (c) => {
    const s = c.get("session");
    const { rows } = await db.query<{ name: string; agent_enabled: boolean }>(
      "SELECT name, agent_enabled FROM institutions WHERE id = $1",
      [s.institutionId],
    );
    return c.json({ ...s, institution: rows[0]?.name, agentEnabled: rows[0]?.agent_enabled ?? false });
  });

  app.put("/institution/agent", staff, async (c) => {
    const s = c.get("session");
    if (s.role !== "admin") return c.json({ error: "Only the institution admin can change this." }, 403);
    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Send enabled as true or false." }, 400);
    await db.query("UPDATE institutions SET agent_enabled = $1 WHERE id = $2", [body.data.enabled, s.institutionId]);
    await appendAudit(db, {
      requestId: null, institutionId: s.institutionId, actor: s.account, action: "institution.agent", detail: body.data,
    });
    return c.json(body.data);
  });

  app.put("/staff/:account/level", staff, async (c) => {
    const s = c.get("session");
    if (s.role !== "admin") return c.json({ error: "Only the institution admin can change this." }, 403);
    const body = z.object({ level: z.number().int().min(1).max(3) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Level must be 1, 2 or 3." }, 400);
    const res = await db.query(
      "UPDATE staff SET level = $1 WHERE account = $2 AND institution_id = $3 RETURNING account",
      [body.data.level, c.req.param("account"), s.institutionId],
    );
    if (res.rows.length === 0) return c.json({ error: "No such staff member." }, 404);
    await appendAudit(db, {
      requestId: null, institutionId: s.institutionId, actor: s.account, action: "staff.level",
      detail: { account: c.req.param("account"), level: body.data.level },
    });
    return c.json(body.data);
  });

  app.get("/stats", staff, async (c) => {
    const s = c.get("session");
    const one = async (sql: string) =>
      Number((await db.query<{ n: number }>(sql, [s.institutionId])).rows[0]?.n ?? 0);
    const series = async (table: string) =>
      monthlySeries((await db.query<{ month: string; n: number }>(
        `SELECT to_char(created_at, 'YYYY-MM') AS month, count(*)::int AS n FROM ${table}
         WHERE institution_id = $1 GROUP BY 1`, [s.institutionId])).rows);
    return c.json({
      operators: await one("SELECT count(*)::int AS n FROM staff WHERE institution_id = $1"),
      documents: await one("SELECT count(*)::int AS n FROM credentials WHERE institution_id = $1"),
      openRequests: await one("SELECT count(*)::int AS n FROM requests WHERE institution_id = $1 AND status <> 'answered'"),
      answered: await one("SELECT count(*)::int AS n FROM requests WHERE institution_id = $1 AND status = 'answered'"),
      storageBytes: await one(`SELECT (COALESCE((SELECT sum(file_size) FROM credentials WHERE institution_id = $1), 0)
        + COALESCE((SELECT sum(file_size) FROM requests WHERE institution_id = $1), 0))::bigint AS n`),
      documentsByMonth: await series("credentials"),
      requestsByMonth: await series("requests"),
    });
  });

  app.get("/staff", staff, async (c) => {
    const s = c.get("session");
    const { rows } = await db.query<{ account: Address; name: string; position: string; level: number }>(
      "SELECT account, name, position, level FROM staff WHERE institution_id = $1 ORDER BY name, account",
      [s.institutionId],
    );
    // Chain decides who is still a member, so removal needs no second bookkeeping step.
    const live = await Promise.all(rows.map(async (r) => ({ ...r, member: await chain.getMember(r.account) })));
    return c.json(live.filter((r) => r.member.role !== "none" && r.member.institutionId === s.institutionId)
      .map(({ member, ...r }) => ({ ...r, role: member.role })));
  });

  /** Saves a member's name and position after the on-chain add. */
  app.post("/staff", staff, async (c) => {
    const s = c.get("session");
    if (s.role !== "admin") return c.json({ error: "Only the institution admin can change this." }, 403);
    const body = z.object({
      account: z.string().regex(/^0x[0-9a-fA-F]{40}$/), name: z.string().trim().min(2).max(120), position: z.string().trim().max(120).default(""),
    }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Enter a name and a valid wallet address." }, 400);
    const member = await chain.getMember(body.data.account as Address);
    if (member.institutionId !== s.institutionId) return c.json({ error: "Add this wallet on-chain first." }, 409);
    await db.query(
      `INSERT INTO staff (account, institution_id, name, position) VALUES ($1,$2,$3,$4)
       ON CONFLICT (account) DO UPDATE SET name = $3, position = $4`,
      [body.data.account, s.institutionId, body.data.name, body.data.position],
    );
    await appendAudit(db, { requestId: null, institutionId: s.institutionId, actor: s.account, action: "staff.added", detail: { account: body.data.account } });
    return c.json({ ok: true }, 201);
  });

  /** Holds the file and private details; the public record gets only the hash. */
  app.post("/credentials", staff, uploadLimit, async (c) => {
    const s = c.get("session");
    const body = await c.req.parseBody();
    const form = CredentialForm.safeParse(body);
    if (!form.success) return c.json({ error: "Check the certificate details." }, 400);
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "Attach the certificate as a PDF." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) return c.json({ error: "Files can be up to 15 MB." }, 413);
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return c.json({ error: "Attach the certificate as a PDF." }, 400);
    const f = form.data;
    const sha = sha256Hex(bytes);
    // The ID comes from the client, so claim it before touching the disk: a repeat must never
    // reach writeFile, or it would replace a file that may belong to another institution.
    const claimed = await db.query(
      `INSERT INTO credentials (id, institution_id, owner_name, title, description, file_name, file_size, file_sha256, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [f.credentialId, s.institutionId, f.ownerName, f.title, f.description, file.name.slice(0, 255), bytes.length, sha, s.account],
    );
    if (claimed.rows.length === 0) return c.json({ error: "This certificate ID is already in use." }, 409);
    try {
      await mkdir(fileDir, { recursive: true });
      await writeFile(filePath(f.credentialId), encryptFile(deps.fileMasterKey, s.institutionId, f.credentialId, bytes));
    } catch (e) {
      await db.query("DELETE FROM credentials WHERE id = $1", [f.credentialId]);
      throw e;
    }
    await appendAudit(db, { requestId: null, institutionId: s.institutionId, actor: s.account, action: "credential.created", detail: { sha } });
    return c.json({ fileHash: `0x${sha}` }, 201);
  });

  const ownCredential = async (id: string, institutionId: number) => {
    const { rows } = await db.query<Record<string, any>>(
      "SELECT * FROM credentials WHERE id = $1 AND institution_id = $2", [id, institutionId],
    );
    return rows[0] ?? null;
  };

  app.get("/credentials", staff, async (c) => {
    const s = c.get("session");
    const { rows } = await db.query<Record<string, any>>(
      `SELECT id, owner_name, title, file_sha256, created_at FROM credentials
       WHERE institution_id = $1 ORDER BY created_at DESC LIMIT 200`, [s.institutionId],
    );
    return c.json(await Promise.all(rows.map(async (r) => ({ ...r, status: await statusOf(r.file_sha256) }))));
  });

  app.get("/credentials/:id", staff, async (c) => {
    const s = c.get("session");
    const r = await ownCredential(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const shares = await db.query(
      `SELECT id, recipient, comment, shared_by, expires_at, revoked_at, created_at FROM shares
       WHERE credential_id = $1 ORDER BY created_at DESC`, [r.id],
    );
    return c.json({ ...r, status: await statusOf(r.file_sha256), shares: shares.rows });
  });

  app.get("/credentials/:id/file", staff, async (c) => {
    const s = c.get("session");
    const r = await ownCredential(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const plain = decryptFile(deps.fileMasterKey, s.institutionId, r.id, await readFile(filePath(r.id)));
    await appendAudit(db, { requestId: null, institutionId: s.institutionId, actor: s.account, action: "credential.viewed", detail: { id: r.id } });
    return c.body(new Uint8Array(plain), 200, { "content-type": "application/pdf", "cache-control": "no-store" });
  });

  /** The link token is shown once and only its hash is stored. */
  app.post("/credentials/:id/shares", staff, async (c) => {
    const s = c.get("session");
    const r = await ownCredential(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const body = ShareForm.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Say who this link is for." }, 400);
    const token = randomBytes(24).toString("base64url");
    const expires = new Date(Date.now() + body.data.expiresInDays * 86_400_000);
    await db.query(
      `INSERT INTO shares (id, credential_id, recipient, comment, token_hash, shared_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), r.id, body.data.recipient, body.data.comment, sha256Hex(token), s.account, expires.toISOString()],
    );
    await appendAudit(db, { requestId: null, institutionId: s.institutionId, actor: s.account, action: "credential.shared", detail: { id: r.id, recipient: body.data.recipient } });
    return c.json({ token, expiresAt: expires }, 201);
  });

  app.post("/credentials/:id/shares/:shareId/revoke", staff, async (c) => {
    const s = c.get("session");
    const r = await ownCredential(c.req.param("id")!, s.institutionId);
    if (!r || !z.uuid().safeParse(c.req.param("shareId")).success) return c.json({ error: "Not found." }, 404);
    await db.query("UPDATE shares SET revoked_at = now() WHERE id = $1 AND credential_id = $2", [c.req.param("shareId"), r.id]);
    await appendAudit(db, { requestId: null, institutionId: s.institutionId, actor: s.account, action: "credential.share_revoked", detail: { id: r.id } });
    return c.json({ ok: true });
  });

  const liveShare = async (token: string) => {
    const { rows } = await db.query<Record<string, any>>(
      `SELECT s.recipient, s.comment, s.expires_at, c.id, c.owner_name, c.title, c.description, c.file_name,
              c.file_sha256, c.institution_id, c.created_at, i.name AS institution
       FROM shares s JOIN credentials c ON c.id = s.credential_id JOIN institutions i ON i.id = c.institution_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [sha256Hex(token)],
    );
    return rows[0] ?? null;
  };

  app.get("/shared/:token", rateLimit(60, 60_000), async (c) => {
    const r = await liveShare(c.req.param("token")!);
    if (!r) return c.json({ error: "This link has expired or was withdrawn." }, 404);
    const { institution_id: _i, file_sha256, ...safe } = r;
    return c.json({ ...safe, status: await statusOf(file_sha256) });
  });

  app.get("/shared/:token/file", rateLimit(60, 60_000), async (c) => {
    const r = await liveShare(c.req.param("token")!);
    if (!r) return c.json({ error: "This link has expired or was withdrawn." }, 404);
    await appendAudit(db, { requestId: null, institutionId: r.institution_id, actor: "share-link", action: "credential.viewed", detail: { id: r.id } });
    const plain = decryptFile(deps.fileMasterKey, r.institution_id, r.id, await readFile(filePath(r.id)));
    return c.body(new Uint8Array(plain), 200, { "content-type": "application/pdf", "cache-control": "no-store" });
  });

  // ---------------------------------------------------------------- platform

  app.get("/platform/overview", platform, async (c) => {
    const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
    const institutions = await db.query(
      `SELECT i.id, i.name, i.active, i.admin, i.location,
        (SELECT count(*)::int FROM credentials c WHERE c.institution_id = i.id) AS documents,
        (SELECT count(*)::int FROM requests r WHERE r.institution_id = i.id) AS requests
       FROM institutions i ORDER BY i.id`,
    );
    return c.json({
      institutions: institutions.rows,
      documents: await n("SELECT count(*)::int AS n FROM credentials"),
      requests: await n("SELECT count(*)::int AS n FROM requests"),
    });
  });

  /** Re-reads chain after an on-chain change, then saves the off-chain location. */
  app.post("/platform/institutions/:id", platform, async (c) => {
    const body = z.object({ location: z.string().trim().max(120) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Enter a location." }, 400);
    await syncInstitutions(db, chain);
    await db.query("UPDATE institutions SET location = $1 WHERE id = $2", [body.data.location, Number(c.req.param("id"))]);
    return c.json({ ok: true });
  });

  app.get("/inbox", staff, async (c) => {
    const s = c.get("session");
    const { rows } = await db.query(
      `SELECT id, requester_org, subject, status, level, priority, escalation_reason, assigned_to, due_at,
              registry_status, triage_status, triage->>'riskLevel' AS risk, created_at
       FROM requests WHERE institution_id = $1 AND status <> 'answered'
       ORDER BY (priority = 'high') DESC, due_at ASC LIMIT 200`,
      [s.institutionId],
    );
    return c.json(rows);
  });

  app.get("/requests/:id", staff, async (c) => {
    const s = c.get("session");
    const r = await ownRequest(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const { tracking_hash: _omit, ...safe } = r;
    return c.json(safe);
  });

  app.get("/requests/:id/file", staff, async (c) => {
    const s = c.get("session");
    const r = await ownRequest(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const blob = await readFile(filePath(r.id));
    await appendAudit(db, { requestId: r.id, institutionId: s.institutionId, actor: s.account, action: "file.viewed" });
    const plain = decryptFile(deps.fileMasterKey, s.institutionId, r.id, blob);
    return c.body(new Uint8Array(plain), 200, { "content-type": "application/pdf", "cache-control": "no-store" });
  });

  app.post("/requests/:id/claim", staff, async (c) => {
    const s = c.get("session");
    const r = await ownRequest(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    await db.query("UPDATE requests SET assigned_to = $1, status = 'in_review' WHERE id = $2", [s.account, r.id]);
    await appendAudit(db, { requestId: r.id, institutionId: s.institutionId, actor: s.account, action: "request.claimed" });
    return c.json({ ok: true });
  });

  app.post("/requests/:id/escalate", staff, async (c) => {
    const s = c.get("session");
    const r = await ownRequest(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Say why you're escalating this." }, 400);
    const next = escalateForSla(r.level, new Date());
    if (!next) return c.json({ error: "This request is already at the top level." }, 409);
    await db.query(
      "UPDATE requests SET level = $1, due_at = $2, escalation_reason = $3, assigned_to = NULL WHERE id = $4",
      [next.level, next.dueAt.toISOString(), body.data.reason, r.id],
    );
    await appendAudit(db, {
      requestId: r.id, institutionId: s.institutionId, actor: s.account, action: "request.escalated",
      detail: { level: next.level, reason: body.data.reason },
    });
    return c.json({ level: next.level });
  });

  /** Only a signed-in person reaches this. The agent has no path to it. */
  app.post("/requests/:id/answer", staff, async (c) => {
    const s = c.get("session");
    const r = await ownRequest(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    if (r.status === "answered") return c.json({ error: "This request has already been answered." }, 409);
    if (s.level < r.level) return c.json({ error: "This request needs a higher level to answer." }, 403);
    const body = Answer.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Check the answer." }, 400);

    const answeredAt = new Date().toISOString();
    const receipt = sha256Hex(JSON.stringify([r.id, r.file_sha256, body.data.outcome, s.institutionId, s.account, answeredAt]));
    await db.query(
      `UPDATE requests SET status = 'answered', answer_outcome = $1, answer_note = $2, answered_by = $3,
         answered_at = $4, receipt_hash = $5 WHERE id = $6`,
      [body.data.outcome, body.data.note, s.account, answeredAt, receipt, r.id],
    );
    await appendAudit(db, {
      requestId: r.id, institutionId: s.institutionId, actor: s.account, action: "request.answered",
      detail: { outcome: body.data.outcome, receipt },
    });
    return c.json({ receipt });
  });

  app.get("/requests/:id/audit", staff, async (c) => {
    const s = c.get("session");
    const r = await ownRequest(c.req.param("id")!, s.institutionId);
    if (!r) return c.json({ error: "Not found." }, 404);
    const { rows } = await db.query(
      "SELECT actor, action, entry_hash, created_at FROM audit_log WHERE request_id = $1 ORDER BY seq",
      [r.id],
    );
    return c.json(rows);
  });

  // -------------------------------------------------------------- sponsorship

  app.post("/sponsor", staff, async (c) => {
    const s = c.get("session");
    if (!deps.signSponsorship) return c.json({ error: "Gas sponsorship isn't set up yet." }, 503);
    const op = z.object({ sender: z.string(), callData: z.string() }).loose().safeParse(await c.req.json().catch(() => null));
    if (!op.success) return c.json({ error: "Send a UserOperation." }, 400);
    const sender = op.data.sender as Address;
    if (sender.toLowerCase() !== s.account.toLowerCase()) return c.json({ error: "denied", reason: "not_a_member" }, 403);

    const day = new Date().toISOString().slice(0, 10);
    const used = await db.query<{ count: number }>(
      "SELECT count FROM sponsorship_usage WHERE institution_id = $1 AND day = $2",
      [s.institutionId, day],
    );
    const denial = evaluateSponsorship({
      sender, callData: op.data.callData as Hex, registry: deps.registry,
      isActiveMember: await chain.canIssue(sender),
      usedToday: used.rows[0]?.count ?? 0, dailyQuota: deps.dailySponsorQuota,
    });
    if (denial) return c.json({ error: "denied", reason: denial }, 403);
    const signed = await deps.signSponsorship(op.data);
    await db.query(
      `INSERT INTO sponsorship_usage (institution_id, day, count) VALUES ($1, $2, 1)
       ON CONFLICT (institution_id, day) DO UPDATE SET count = sponsorship_usage.count + 1`,
      [s.institutionId, day],
    );
    return c.json(signed);
  });

  return app;
}

/** Keeps the public directory in step with chain. */
export async function syncInstitutions(db: Db, chain: Chain) {
  for (const i of await chain.listInstitutions()) {
    await db.query(
      `INSERT INTO institutions (id, name, active, admin) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name = $2, active = $3, admin = $4`,
      [i.id, i.name, i.active, i.admin],
    );
  }
}

/** Moves overdue requests up the ladder. Returns how many moved. */
export async function runSlaSweep(db: Db, now = new Date()): Promise<number> {
  const { rows } = await db.query<{ id: string; institution_id: number; level: number }>(
    "SELECT id, institution_id, level FROM requests WHERE status <> 'answered' AND due_at < $1 AND level < 3",
    [now.toISOString()],
  );
  for (const r of rows) {
    const next = escalateForSla(r.level, now);
    if (!next) continue;
    await db.query(
      "UPDATE requests SET level = $1, due_at = $2, escalation_reason = $3, priority = 'high', assigned_to = NULL WHERE id = $4",
      [next.level, next.dueAt.toISOString(), next.reason, r.id],
    );
    await appendAudit(db, {
      requestId: r.id, institutionId: r.institution_id, actor: "system", action: "request.escalated",
      detail: { level: next.level, reason: next.reason },
    });
  }
  return rows.length;
}
