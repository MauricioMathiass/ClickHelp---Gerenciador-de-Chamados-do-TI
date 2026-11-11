export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const unauthorized = (message = "Sessao invalida ou expirada. Entre novamente.") =>
  new HttpError(401, message);
export const forbidden = (message = "Voce nao tem permissao para esta acao.") => new HttpError(403, message);
export const notFound = (message) => new HttpError(404, message);
