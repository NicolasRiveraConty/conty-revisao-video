import { describe, expect, it } from "vitest";
import { approveDelivery, DeliveryApprovalError } from "../src/domain/approveDelivery.js";
import type { Campaign, PieceType, Version, VersionStatus } from "../src/domain/model.js";

function campaign(requiredPieces: PieceType[]): Campaign {
  return {
    id: "campanha-1",
    name: "Verão",
    requiredPieces,
    deliveryStatus: "em_producao",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function version(piece: PieceType, status: VersionStatus, number = 1): Version {
  return {
    id: `${piece}-v${number}`,
    campaignId: "campanha-1",
    piece,
    number,
    source: "arquivo-falso.mp4",
    durationSeconds: 30,
    status,
    comments: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("approveDelivery", () => {
  it("falha com erro claro listando as peças obrigatórias pendentes", () => {
    const versions = [
      version("video", "aprovada"),
      version("capa", "em_revisao"),
    ];

    expect(() => approveDelivery(campaign(["roteiro", "video", "capa", "legenda"]), versions)).toThrow(
      DeliveryApprovalError,
    );

    try {
      approveDelivery(campaign(["roteiro", "video", "capa", "legenda"]), versions);
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryApprovalError);
      expect((error as DeliveryApprovalError).pendingPieces).toEqual(["roteiro", "capa", "legenda"]);
      expect((error as DeliveryApprovalError).message).toContain("roteiro");
      expect((error as DeliveryApprovalError).statusCode).toBe(422);
    }
  });

  it("campanha só de vídeo não exige roteiro", () => {
    const result = approveDelivery(campaign(["video"]), [version("video", "aprovada")]);

    expect(result.deliveryStatus).toBe("aprovada");
  });

  it("peça que a campanha não pediu não bloqueia", () => {
    const result = approveDelivery(campaign(["video"]), [
      version("video", "aprovada"),
      version("roteiro", "em_revisao"),
      version("capa", "em_revisao"),
    ]);

    expect(result.deliveryStatus).toBe("aprovada");
  });

  it("a ordem das pendências segue requiredPieces da campanha", () => {
    try {
      approveDelivery(campaign(["legenda", "roteiro"]), []);
      expect.unreachable();
    } catch (error) {
      expect((error as DeliveryApprovalError).pendingPieces).toEqual(["legenda", "roteiro"]);
    }
  });

  it("versão anterior aprovada não conta depois que uma nova a substitui", () => {
    const versions = [version("video", "aprovada", 1), version("video", "em_revisao", 2)];

    expect(() => approveDelivery(campaign(["video"]), versions)).toThrow(DeliveryApprovalError);

    try {
      approveDelivery(campaign(["video"]), versions);
    } catch (error) {
      expect((error as DeliveryApprovalError).pendingPieces).toEqual(["video"]);
    }
  });

  it("aprova quando a versão atual de cada peça exigida está aprovada", () => {
    const result = approveDelivery(campaign(["roteiro", "video"]), [
      version("roteiro", "em_revisao", 1),
      version("roteiro", "aprovada", 2),
      version("video", "aprovada", 1),
    ]);

    expect(result.deliveryStatus).toBe("aprovada");
  });
});
