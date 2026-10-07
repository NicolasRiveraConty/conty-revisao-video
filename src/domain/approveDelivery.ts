import { AppError } from "./errors.js";
import type { Campaign, PieceType, Version } from "./model.js";
import { currentVersionOfEachPiece } from "./versions.js";

export class DeliveryApprovalError extends AppError {
  readonly pendingPieces: PieceType[];

  constructor(pendingPieces: PieceType[]) {
    const list = pendingPieces.join(", ");
    super(
      `Entrega não pode ser aprovada: peças obrigatórias pendentes (${list}).`,
      422,
      { pendingPieces },
    );
    this.pendingPieces = pendingPieces;
  }
}

/**
 * Aprova a entrega.
 *
 * A lista consultada é `campaign.requiredPieces` — dado da campanha, não um
 * if por tipo de peça. Para cada item dessa lista, a versão atual (maior
 * `number`) precisa estar aprovada. Peça fora da lista não bloqueia.
 * Versão anterior, mesmo aprovada, não substitui a atual.
 */
export function approveDelivery(campaign: Campaign, versions: readonly Version[]): Campaign {
  const current = currentVersionOfEachPiece(
    versions.filter((version) => version.campaignId === campaign.id),
  );

  const pendingPieces = campaign.requiredPieces.filter(
    (piece) => current[piece]?.status !== "aprovada",
  );

  if (pendingPieces.length > 0) {
    throw new DeliveryApprovalError(pendingPieces);
  }

  return { ...campaign, deliveryStatus: "aprovada" };
}
