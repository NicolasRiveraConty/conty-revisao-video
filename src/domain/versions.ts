import type { PieceType, Version } from "./model.js";

/** A versão atual de cada peça é a de maior `number`. As outras ficam no histórico. */
export function currentVersionOfEachPiece(
  versions: readonly Version[],
): Partial<Record<PieceType, Version>> {
  const current: Partial<Record<PieceType, Version>> = {};

  for (const version of versions) {
    const previous = current[version.piece];
    if (!previous || version.number > previous.number) {
      current[version.piece] = version;
    }
  }

  return current;
}

export function isCurrentVersion(versions: readonly Version[], version: Version): boolean {
  return currentVersionOfEachPiece(versions)[version.piece]?.id === version.id;
}
