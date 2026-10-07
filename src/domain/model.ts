export const PIECE_TYPES = ["roteiro", "video", "capa", "legenda"] as const;

export type PieceType = (typeof PIECE_TYPES)[number];

export type VersionStatus = "em_revisao" | "aprovada";

export type DeliveryStatus = "em_producao" | "aprovada";

export interface Comment {
  id: string;
  second: number;
  text: string;
  createdAt: string;
}

export interface Version {
  id: string;
  campaignId: string;
  piece: PieceType;
  number: number;
  source: string;
  durationSeconds: number | null;
  status: VersionStatus;
  comments: Comment[];
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  requiredPieces: PieceType[];
  deliveryStatus: DeliveryStatus;
  createdAt: string;
}

export function isPieceType(value: unknown): value is PieceType {
  return typeof value === "string" && (PIECE_TYPES as readonly string[]).includes(value);
}
