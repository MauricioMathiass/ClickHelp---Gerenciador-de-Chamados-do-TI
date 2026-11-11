import { MOVABLE_HOLIDAYS } from "../tickets/sla.js";
import { getPublicSettings, getSettings, updateSettings } from "./settings.service.js";

const movableHolidayOptions = Object.entries(MOVABLE_HOLIDAYS).map(([value, { label }]) => ({
  value,
  label,
}));

export const getPublic = async (_req, res) => {
  res.status(200).json(await getPublicSettings());
};

export const getAll = async (_req, res) => {
  res
    .status(200)
    .json({ settings: await getSettings(), options: { movableHolidays: movableHolidayOptions } });
};

export const update = async (req, res) => {
  const settings = await updateSettings(req.body ?? {});

  res.status(200).json({
    message: "Configurações salvas com sucesso.",
    settings,
  });
};
