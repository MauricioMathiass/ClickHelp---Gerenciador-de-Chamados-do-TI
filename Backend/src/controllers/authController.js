import { config } from "../config.js";
import { badRequest, unauthorized } from "../lib/httpError.js";
import { signToken } from "../lib/security.js";
import {
  createUser,
  findUserByCredentials,
  listUsers,
  sanitizeUser,
  updateUser,
} from "../services/userService.js";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 horas
const REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

// Express 5 encaminha erros de funções async para o tratador de erros.
export const login = async (req, res) => {
  const { username, password, rememberMe } = req.body ?? {};

  if (!String(username ?? "").trim() || !String(password ?? "").trim()) {
    throw badRequest("Preencha usuario e senha.");
  }

  const user = await findUserByCredentials({ username, password });

  if (!user) {
    throw unauthorized("Usuario ou senha invalidos.");
  }

  const publicUser = sanitizeUser(user);
  const token = signToken(
    { sub: publicUser.id, ...publicUser },
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

export const registerUser = async (req, res) => {
  const user = await createUser(req.body ?? {});

  res.status(201).json({
    message: "Usuario cadastrado com sucesso.",
    user: sanitizeUser(user),
  });
};

export const getUsers = async (_req, res) => {
  res.status(200).json({ users: await listUsers() });
};

export const updateUserHandler = async (req, res) => {
  const { role, active, password } = req.body ?? {};
  const user = await updateUser(req.params.id, { role, active, password }, req.user);

  res.status(200).json({
    message: "Usuario atualizado com sucesso.",
    user,
  });
};
