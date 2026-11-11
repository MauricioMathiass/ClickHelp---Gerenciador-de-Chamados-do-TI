import { createChamado, listChamados, updateChamado } from "../services/chamadoService.js";

// Express 5 encaminha erros de funções async para o tratador de erros.
export const getChamados = async (req, res) => {
  const chamados = await listChamados(req.user);
  res.status(200).json({ chamados });
};

export const createChamadoHandler = async (req, res) => {
  const chamado = await createChamado(req.body ?? {}, req.user);

  res.status(201).json({
    message: "Chamado criado com sucesso.",
    chamado,
  });
};

export const updateChamadoHandler = async (req, res) => {
  const chamado = await updateChamado(req.params.id, req.body ?? {}, req.user);

  res.status(200).json({
    message: "Chamado atualizado com sucesso.",
    chamado,
  });
};
