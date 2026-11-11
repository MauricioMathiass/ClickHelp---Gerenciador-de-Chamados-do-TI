import {
  archiveNotificationsForUser,
  listNotificationsForUser,
  markNotificationsAsRead,
} from "../services/notificationService.js";

export const getNotifications = async (req, res) => {
  res.status(200).json(await listNotificationsForUser(req.user));
};

export const readNotifications = async (req, res) => {
  await markNotificationsAsRead(req.user, req.body?.ids, { all: req.body?.all === true });
  res.status(200).json(await listNotificationsForUser(req.user));
};

export const clearNotifications = async (req, res) => {
  await archiveNotificationsForUser(req.user);
  res.status(200).json(await listNotificationsForUser(req.user));
};
