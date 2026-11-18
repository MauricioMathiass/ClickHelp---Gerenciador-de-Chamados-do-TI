import { config } from "../../config/env.js";
import { isDemoMode } from "../../shared/demo.js";
import { badRequest, HttpError, notFound, unauthorized } from "../../shared/http/httpError.js";
import { signToken } from "../../shared/security.js";
import { getDemoAccount } from "../demo/demo.service.js";
import { findUserByCredentials, sanitizeUser } from "../users/users.service.js";
import { clearFailures, getLockMinutes, registerFailure } from "./loginThrottle.js";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 horas
const REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

// Express 5 encaminha erros de funções async para o tratador de erros.
export const login = async (req, res) => {
  const { username, password, rememberMe } = req.body ?? {};

  if (!String(username ?? "").trim() || !String(password ?? "").trim()) {
    throw badRequest("Preencha usuário e senha.");
  }

  const lockMinutes = getLockMinutes(req.ip, username);

  if (lockMinutes) {
    throw new HttpError(
      429,
      `Muitas tentativas de login. Tente de novo em ${lockMinutes} minuto${lockMinutes > 1 ? "s" : ""}.`
    );
  }

  const user = await findUserByCredentials({ username, password });

  if (!user) {
    registerFailure(req.ip, username);
    throw unauthorized("Usuário ou senha inválidos.");
  }

  clearFailures(req.ip, username);
  sendSession(res, user, rememberMe ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS);
};

/** Entrada sem senha com um perfil de exemplo. Só existe com DEMO_MODE=true. */
export const demoLogin = async (req, res) => {
  if (!isDemoMode()) {
    throw notFound("Rota não encontrada.");
  }

  const user = await getDemoAccount(req.body?.perfil);
  sendSession(res, user, SESSION_TTL_SECONDS);
};

const sendSession = (res, user, ttlSeconds) => {
  const publicUser = sanitizeUser(user);
  const token = signToken(
    // pv = versão da senha: redefinir a senha invalida os tokens antigos.
    { sub: publicUser.id, ...publicUser, pv: user.passwordVersion ?? 0 },
    config.jwtSecret,
    ttlSeconds
  );

  res.status(200).json({
    message: "Login realizado com sucesso.",
    token,
    user: publicUser,
  });
};

export const me = (req, res) => {
  res.status(200).json({ user: req.user });
};
