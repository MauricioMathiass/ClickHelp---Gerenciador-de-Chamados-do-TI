import { config } from "../config.js";
import { forbidden, unauthorized } from "../lib/httpError.js";
import { verifyToken } from "../lib/security.js";
import { findActiveUserById, sanitizeUser } from "../services/userService.js";

/**
 * Exige um token válido e coloca o usuário em `req.user`.
 * O usuário é recarregado a cada requisição: quem foi desativado perde o
 * acesso na hora, e mudanças de perfil valem sem precisar entrar de novo.
 */
export const requireAuth = async (req, _res, next) => {
  const [scheme, token] = String(req.headers.authorization ?? "").split(" ");
  const payload = scheme === "Bearer" ? verifyToken(token, config.jwtSecret) : null;

  if (!payload) {
    return next(unauthorized());
  }

  const user = await findActiveUserById(payload.sub);

  if (!user || user.username !== payload.username) {
    return next(unauthorized());
  }

  req.user = sanitizeUser(user);
  return next();
};

/** Exige que o usuário autenticado tenha um dos perfis informados. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden());
    }

    return next();
  };
