import { AppError } from "./errors.js";

/**
 * O comentário fica preso a um segundo. Se a versão tem duração, o segundo
 * precisa caber nela (0 inclusive até `durationSeconds` inclusive).
 */
export function assertCommentSecond(second: unknown, durationSeconds: number | null): number {
  if (typeof second !== "number" || !Number.isFinite(second) || second < 0) {
    throw new AppError("O segundo do comentário deve ser um número maior ou igual a zero.", 400);
  }

  if (durationSeconds != null && second > durationSeconds) {
    throw new AppError(
      `Comentário no segundo ${second} está fora da duração (${durationSeconds}s).`,
      422,
    );
  }

  return second;
}
