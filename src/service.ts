import { randomUUID } from "node:crypto";
import { approveDelivery as approveDeliveryRule } from "./domain/approveDelivery.js";
import { assertCommentSecond } from "./domain/comments.js";
import { AppError } from "./domain/errors.js";
import {
  isPieceType,
  PIECE_TYPES,
  type Campaign,
  type Comment,
  type PieceType,
  type Version,
} from "./domain/model.js";
import { currentVersionOfEachPiece, isCurrentVersion } from "./domain/versions.js";
import { MemoryRepository, type Repository } from "./repository.js";

export interface PieceState {
  current: Version | null;
  versions: Version[];
}

export interface CampaignView extends Campaign {
  pieces: Partial<Record<PieceType, PieceState>>;
}

export class CampaignService {
  constructor(private readonly repo: Repository = new MemoryRepository()) {}

  createCampaign(input: { name: unknown; requiredPieces: unknown }): CampaignView {
    const name = parseName(input.name);
    const requiredPieces = parseRequiredPieces(input.requiredPieces);
    const campaign: Campaign = {
      id: randomUUID(),
      name,
      requiredPieces,
      deliveryStatus: "em_producao",
      createdAt: new Date().toISOString(),
    };
    this.repo.saveCampaign(campaign);
    return this.view(campaign);
  }

  getCampaign(campaignId: string): CampaignView {
    return this.view(this.requireCampaign(campaignId));
  }

  addVersion(
    campaignId: string,
    pieceParam: string,
    input: { source: unknown; durationSeconds?: unknown },
  ): Version {
    const campaign = this.requireCampaign(campaignId);
    const piece = parsePiece(pieceParam);
    const versions = this.repo.listPieceVersions(campaignId, piece);
    const version: Version = {
      id: randomUUID(),
      campaignId,
      piece,
      number: (versions.at(-1)?.number ?? 0) + 1,
      source: parseSource(input.source),
      durationSeconds: parseDuration(input.durationSeconds),
      status: "em_revisao",
      comments: [],
      createdAt: new Date().toISOString(),
    };
    this.repo.saveVersion(version);

    if (campaign.deliveryStatus === "aprovada" && campaign.requiredPieces.includes(piece)) {
      this.repo.saveCampaign({ ...campaign, deliveryStatus: "em_producao" });
    }

    return version;
  }

  listVersions(campaignId: string, pieceParam: string): Version[] {
    this.requireCampaign(campaignId);
    return this.repo.listPieceVersions(campaignId, parsePiece(pieceParam));
  }

  getVersion(campaignId: string, pieceParam: string, versionId: string): Version {
    return this.requireVersion(campaignId, parsePiece(pieceParam), versionId);
  }

  addComment(
    campaignId: string,
    pieceParam: string,
    versionId: string,
    input: { second: unknown; text: unknown },
  ): Comment {
    const piece = parsePiece(pieceParam);
    const version = this.requireVersion(campaignId, piece, versionId);
    const second = assertCommentSecond(input.second, version.durationSeconds);
    const text = parseCommentText(input.text);
    const comment: Comment = {
      id: randomUUID(),
      second,
      text,
      createdAt: new Date().toISOString(),
    };
    this.repo.saveVersion({ ...version, comments: [...version.comments, comment] });
    return comment;
  }

  approveVersion(campaignId: string, pieceParam: string, versionId: string): Version {
    const piece = parsePiece(pieceParam);
    const version = this.requireVersion(campaignId, piece, versionId);
    const history = this.repo.listPieceVersions(campaignId, piece);

    if (!isCurrentVersion(history, version)) {
      const current = currentVersionOfEachPiece(history)[piece];
      throw new AppError(
        `Só a versão atual pode ser aprovada. A versão ${version.number} foi substituída pela versão ${current?.number}.`,
        409,
      );
    }

    const approved: Version = { ...version, status: "aprovada" };
    this.repo.saveVersion(approved);
    return approved;
  }

  approveDelivery(campaignId: string): CampaignView {
    const campaign = this.requireCampaign(campaignId);
    const versions = this.repo.listCampaignVersions(campaignId);
    const approved = approveDeliveryRule(campaign, versions);
    this.repo.saveCampaign(approved);
    return this.view(approved);
  }

  private view(campaign: Campaign): CampaignView {
    const versions = this.repo.listCampaignVersions(campaign.id);
    const current = currentVersionOfEachPiece(versions);
    const pieces = new Set<PieceType>([
      ...campaign.requiredPieces,
      ...versions.map((version) => version.piece),
    ]);
    const pieceStates: Partial<Record<PieceType, PieceState>> = {};

    for (const piece of pieces) {
      pieceStates[piece] = {
        current: current[piece] ?? null,
        versions: versions.filter((version) => version.piece === piece),
      };
    }

    return { ...campaign, pieces: pieceStates };
  }

  private requireCampaign(campaignId: string): Campaign {
    const campaign = this.repo.getCampaign(campaignId);
    if (!campaign) {
      throw new AppError("Campanha não encontrada.", 404);
    }
    return campaign;
  }

  private requireVersion(campaignId: string, piece: PieceType, versionId: string): Version {
    this.requireCampaign(campaignId);
    const version = this.repo.getVersion(versionId);
    if (!version || version.campaignId !== campaignId || version.piece !== piece) {
      throw new AppError("Versão não encontrada.", 404);
    }
    return version;
  }
}

function parseName(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("Informe o nome da campanha.", 400);
  }
  return value.trim();
}

function parseRequiredPieces(value: unknown): PieceType[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("requiredPieces deve listar ao menos uma peça.", 400);
  }

  const pieces: PieceType[] = [];
  for (const item of value) {
    if (!isPieceType(item)) {
      throw new AppError(`Peça desconhecida: ${String(item)}. Valores: ${PIECE_TYPES.join(", ")}.`, 400);
    }
    if (pieces.includes(item)) {
      throw new AppError(`Peça repetida em requiredPieces: ${item}.`, 400);
    }
    pieces.push(item);
  }
  return pieces;
}

function parsePiece(value: string): PieceType {
  if (!isPieceType(value)) {
    throw new AppError(`Peça desconhecida: ${value}. Valores: ${PIECE_TYPES.join(", ")}.`, 400);
  }
  return value;
}

function parseSource(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("Informe source com uma URL ou um nome de arquivo.", 400);
  }
  return value.trim();
}

function parseDuration(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError("durationSeconds deve ser um número maior ou igual a zero.", 400);
  }
  return value;
}

function parseCommentText(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("Informe o texto do comentário.", 400);
  }
  return value.trim();
}
