import { mockUsers } from "../data/mockUsers.js";

const normalizeUsername = (value) => String(value ?? "").trim().toLowerCase();
const normalizePassword = (value) => String(value ?? "").trim();
const normalizeNameToken = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const customUsers = [];

export const findUserByCredentials = ({ username, password }) =>
  [...mockUsers, ...customUsers].find(
    (user) =>
      normalizeUsername(user.username) === normalizeUsername(username) &&
      user.passwords.includes(normalizePassword(password))
  ) ?? null;

export const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  department: user.department,
});

const buildUsernameFromName = (name, surname, existingUsers) => {
  const baseUsername = `${normalizeNameToken(name)}.${normalizeNameToken(surname)}`.replace(/\.+/g, ".");
  let candidate = baseUsername || `usuario.${Date.now()}`;
  let counter = 1;

  while (existingUsers.some((user) => normalizeUsername(user.username) === candidate)) {
    counter += 1;
    candidate = `${baseUsername}.${counter}`;
  }

  return candidate;
};

export const createUser = ({ name, surname, password }) => {
  const trimmedName = String(name ?? "").trim();
  const trimmedSurname = String(surname ?? "").trim();
  const trimmedPassword = normalizePassword(password);

  if (!trimmedName || !trimmedSurname || !trimmedPassword) {
    throw new Error("Preencha todos os campos obrigatorios.");
  }

  const allUsers = [...mockUsers, ...customUsers];
  const username = buildUsernameFromName(trimmedName, trimmedSurname, allUsers);
  const nextId = allUsers.reduce((highestId, user) => Math.max(highestId, Number(user.id) || 0), 0) + 1;

  const newUser = {
    id: nextId,
    username,
    passwords: [trimmedPassword],
    name: `${trimmedName} ${trimmedSurname}`,
    role: "Usuario",
    department: "Atendimento",
  };

  customUsers.unshift(newUser);
  return newUser;
};
