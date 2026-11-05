import {
  createChamado,
  listChamados,
  updateChamado,
} from "../services/chamadoService.js";

export const getChamados = async (req, res) => {
  try {
    const chamados = await listChamados({
      role: req.query.role,
      solicitante: req.query.solicitante,
    });

    return res.status(200).json({ chamados });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Nao foi possivel carregar os chamados.",
    });
  }
};

export const createChamadoHandler = async (req, res) => {
  try {
    const chamado = await createChamado(req.body ?? {});

    return res.status(201).json({
      message: "Chamado criado com sucesso.",
      chamado,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Nao foi possivel criar o chamado.",
    });
  }
};

export const updateChamadoHandler = async (req, res) => {
  try {
    const chamado = await updateChamado(req.params.id, req.body ?? {});

    if (!chamado) {
      return res.status(404).json({
        message: "Chamado nao encontrado.",
      });
    }

    return res.status(200).json({
      message: "Chamado atualizado com sucesso.",
      chamado,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Nao foi possivel atualizar o chamado.",
    });
  }
};
