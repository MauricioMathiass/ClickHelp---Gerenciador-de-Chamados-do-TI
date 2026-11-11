import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

const base64url = (value) => Buffer.from(value).toString("base64url");

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

/** Gera um hash "scrypt$salt$hash" para guardar a senha. */
export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(String(password), salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("hex")}`;
};

export const verifyPassword = async (password, storedHash) => {
  const [algorithm, salt, hash] = String(storedHash ?? "").split("$");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derived = await scrypt(String(password), salt, KEY_LENGTH);
  return safeEqual(derived.toString("hex"), hash);
};

/** Compara dois textos em tempo constante (ex.: senha do admin vinda do .env). */
export const safeTextEqual = (left, right) => {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
};

/** Cria um JWT (HS256). */
export const signToken = (payload, secret, expiresInSeconds) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

/** Valida um JWT (HS256) e devolve o payload, ou null se inválido/expirado. */
export const verifyToken = (token, secret) => {
  const parts = String(token ?? "").split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");

  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
