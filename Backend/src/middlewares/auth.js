import { config } from "../config.js";
import { forbidden, unauthorized } from "../lib/httpError.js";
import { verifyToken } from "../lib/security.js";

/** Exige um token válido e coloca o usuário em `req.user`. */
export const requireAuth = (req, _res, next) => {
  const [scheme, token] = String(req.headers.authorization ?? "").split(" ");
  const payload = scheme === "Bearer" ? verifyToken(token, config.jwtSecret) : null;

  if (!payload) {
    return next(unauthorized());
  }

  req.user = {
    id: payload.sub,
    username: payload.username,
    name: payload.name,
    role: payload.role,
    department: payload.department,
  };

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
