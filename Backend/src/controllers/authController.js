import { createUser, findUserByCredentials, sanitizeUser } from "../services/userService.js";

export const login = (req, res) => {
  const { username, password } = req.body ?? {};

  if (!String(username ?? "").trim() || !String(password ?? "").trim()) {
    return res.status(400).json({
      message: "Preencha usuario e senha.",
    });
  }

  const user = findUserByCredentials({ username, password });

  if (!user) {
    return res.status(401).json({
      message: "Usuario ou senha invalidos.",
    });
  }

  return res.status(200).json({
    message: "Login realizado com sucesso.",
    token: `backend-token-${user.id}-${Date.now()}`,
    user: sanitizeUser(user),
  });
};

export const registerUser = (req, res) => {
  const { name, surname, password } = req.body ?? {};

  try {
    const user = createUser({ name, surname, password });

    return res.status(201).json({
      message: "Usuario cadastrado com sucesso.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Nao foi possivel cadastrar o usuario.",
    });
  }
};
