import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendMail } from "./mail";
import { verificationMessage } from "./verification-message";
import { ensureCatalog, getDb } from "./db";

export const SESSION_COOKIE = "sg_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const usernameSchema = z.string().regex(/^[A-Za-z0-9_]{3,20}$/, "Username must be 3–20 letters, digits, or underscores.");
export const passwordSchema = z.string().min(10, "Password must be at least 10 characters.").max(200, "Password is too long.");
export const emailSchema = z.email("Enter a valid email.");

export type Viewer = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  overallElo: number;
  debuggingElo: number;
  securityElo: number;
  comprehensionElo: number;
  performanceElo: number;
  architectureElo: number;
  mlElo: number;
  totalChallengesSolved: number;
  currentStreak: number;
  longestStreak: number;
  shields: number;
  rated: boolean;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure,
  };
}

export async function getViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureCatalog();
  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { stats: true, streak: true, _count: { select: { submissions: true } } } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { tokenHash: session.tokenHash } }).catch(() => undefined);
    return null;
  }
  const { user } = session;
  if (!user.emailVerifiedAt) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    overallElo: user.stats?.overallElo ?? 1200,
    debuggingElo: user.stats?.debuggingElo ?? 1200,
    securityElo: user.stats?.securityElo ?? 1200,
    comprehensionElo: user.stats?.comprehensionElo ?? 1200,
    performanceElo: user.stats?.performanceElo ?? 1200,
    architectureElo: user.stats?.architectureElo ?? 1200,
    mlElo: user.stats?.mlElo ?? 1200,
    totalChallengesSolved: user.stats?.totalChallengesSolved ?? 0,
    currentStreak: user.streak?.currentStreak ?? 0,
    longestStreak: user.streak?.longestStreak ?? 0,
    shields: user.streak?.streakFreezesLeft ?? 0,
    rated: user._count.submissions > 0,
  };
}

type AuthResult = { ok: true; token?: string; verificationRequired?: boolean } | { ok: false; status: number; error: string };

const VERIFICATION_MS = 24 * 60 * 60 * 1000;

async function createVerification(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = getDb();
  await db.emailVerification.deleteMany({ where: { userId, usedAt: null } });
  await db.emailVerification.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFICATION_MS),
    },
  });
  return token;
}

async function deliverVerification(email: string, origin: string, token: string): Promise<void> {
  const message = verificationMessage(origin, token);
  await sendMail({ to: email, subject: message.subject, text: message.text });
}

async function issueSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getDb().session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    },
  });
  return token;
}

function duplicate(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

export async function registerAccount(input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  origin: string;
}): Promise<AuthResult> {
  const username = usernameSchema.safeParse(input.username);
  const email = emailSchema.safeParse(input.email);
  const password = passwordSchema.safeParse(input.password);
  if (!username.success) return { ok: false, status: 400, error: username.error.issues[0]?.message ?? "Invalid username." };
  if (!email.success) return { ok: false, status: 400, error: email.error.issues[0]?.message ?? "Invalid email." };
  if (!password.success) return { ok: false, status: 400, error: password.error.issues[0]?.message ?? "Invalid password." };
  if (input.password !== input.confirmPassword) return { ok: false, status: 400, error: "Passwords do not match." };
  await ensureCatalog();
  const passwordHash = await bcrypt.hash(password.data, 10);
  try {
    const user = await getDb().$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username: username.data, email: email.data, passwordHash },
      });
      await tx.userStats.create({ data: { userId: created.id } });
      await tx.userStreak.create({ data: { userId: created.id } });
      return created;
    });
    try {
      const token = await createVerification(user.id);
      await deliverVerification(email.data, input.origin, token);
    } catch (error) {
      await getDb().user.delete({ where: { id: user.id } }).catch(() => undefined);
      if (error instanceof Error && error.message === "SMTP_PASS is not set.") {
        return { ok: false, status: 503, error: "Confirmation email is not configured yet." };
      }
      return { ok: false, status: 503, error: "The confirmation email could not be sent. Nothing was saved." };
    }
    return { ok: true, verificationRequired: true };
  } catch (error) {
    if (duplicate(error)) return { ok: false, status: 409, error: "That username or email is already registered." };
    throw error;
  }
}

export async function confirmEmail(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  await ensureCatalog();
  const db = getDb();
  const row = await db.emailVerification.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return false;
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerification.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}

export async function resendVerification(username: string, origin: string): Promise<"sent" | "idle" | "unconfigured" | "failed"> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return "idle";
  await ensureCatalog();
  const user = await getDb().user.findUnique({ where: { username: parsed.data } });
  if (!user || user.emailVerifiedAt) return "idle";
  const latest = await getDb().emailVerification.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) return "idle";
  try {
    const token = await createVerification(user.id);
    await deliverVerification(user.email, origin, token);
    return "sent";
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_PASS is not set.") return "unconfigured";
    return "failed";
  }
}

export async function loginAccount(input: { username: string; password: string }): Promise<AuthResult> {
  const username = usernameSchema.safeParse(input.username);
  const password = passwordSchema.safeParse(input.password);
  if (!username.success || !password.success) {
    return { ok: false, status: 401, error: "Unknown username or password." };
  }
  await ensureCatalog();
  const user = await getDb().user.findUnique({ where: { username: username.data } });
  const match = user ? await bcrypt.compare(password.data, user.passwordHash) : false;
  if (!user || !match) return { ok: false, status: 401, error: "Unknown username or password." };
  if (!user.emailVerifiedAt) return { ok: false, status: 403, error: "Confirm your email before signing in." };
  return { ok: true, token: await issueSession(user.id) };
}

export async function logoutAccount(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await getDb().session.delete({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
}
