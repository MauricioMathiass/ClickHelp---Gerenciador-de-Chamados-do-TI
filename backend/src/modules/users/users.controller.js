import { createUser, listUsers, sanitizeUser, updateUser } from "./users.service.js";

export const getUsers = async (_req, res) => {
  res.status(200).json({ users: await listUsers() });
};

export const createUserHandler = async (req, res) => {
  const user = await createUser(req.body ?? {});

  res.status(201).json({
    message: "Usuário cadastrado com sucesso.",
    user: sanitizeUser(user),
  });
};

export const updateUserHandler = async (req, res) => {
  const { role, active, password, department } = req.body ?? {};
  const user = await updateUser(req.params.id, { role, active, password, department }, req.user);

  res.status(200).json({
    message: "Usuário atualizado com sucesso.",
    user,
  });
};
