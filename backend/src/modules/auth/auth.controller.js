import { config } from "../../config/env.js";
import { badRequest, unauthorized } from "../../shared/http/httpError.js";
import { signToken } from "../../shared/security.js";
import { findUserByCredentials, sanitizeUser } from "../users/users.service.js";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 horas
const REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

// Express 5 encaminha erros de funções async para o tratador de erros.
export const login = async (req, res) => {
  const { username, password, rememberMe } = req.body ?? {};

  if (!String(username ?? "").trim() || !String(password ?? "").trim()) {
    throw badRequest("Preencha usuário e senha.");
  }

  const user = await findUserByCredentials({ username, password });

  if (!user) {
    throw unauthorized("Usuário ou senha inválidos.");
  }

  const publicUser = sanitizeUser(user);
  const token = signToken(
    // pv = versão da senha: redefinir a senha invalida os tokens antigos.
    { sub: publicUser.id, ...publicUser, pv: Number(user.passwordVersion ?? 0) },
    config.jwtSecret,
    rememberMe ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS
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
