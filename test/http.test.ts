import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { MemoryRepository } from "../src/repository.js";
import { CampaignService } from "../src/service.js";

let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
});

function createApp(): FastifyInstance {
  app = buildApp(new CampaignService(new MemoryRepository()));
  return app;
}

describe("HTTP", () => {
  it("aprovar a entrega com peça obrigatória pendente responde 422 com a lista", async () => {
    const http = createApp();
    const created = await http.inject({
      method: "POST",
      url: "/campaigns",
      payload: { name: "Verão", requiredPieces: ["roteiro", "video", "capa"] },
    });
    expect(created.statusCode).toBe(201);
    const campaignId = created.json().id as string;

    const video = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/video/versions`,
      payload: { source: "arquivo-falso.mp4", durationSeconds: 15 },
    });
    const versionId = video.json().id as string;

    const approved = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/video/versions/${versionId}/approve`,
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("aprovada");

    const delivery = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/delivery/approve`,
    });

    expect(delivery.statusCode).toBe(422);
    expect(delivery.json()).toMatchObject({
      pendingPieces: ["roteiro", "capa"],
    });
    expect(delivery.json().error).toContain("roteiro");
    expect(delivery.json().error).toContain("capa");
  });

  it("campanha só de vídeo aprova sem roteiro", async () => {
    const http = createApp();
    const created = await http.inject({
      method: "POST",
      url: "/campaigns",
      payload: { name: "Só corte", requiredPieces: ["video"] },
    });
    const campaignId = created.json().id as string;

    const video = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/video/versions`,
      payload: { source: "https://exemplo/corte.mp4", durationSeconds: 12 },
    });
    await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/video/versions/${video.json().id}/approve`,
    });

    const delivery = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/delivery/approve`,
    });

    expect(delivery.statusCode).toBe(200);
    expect(delivery.json().deliveryStatus).toBe("aprovada");
    expect(delivery.json().requiredPieces).toEqual(["video"]);
  });

  it("comentário permanece na versão antiga quando uma nova a substitui", async () => {
    const http = createApp();
    const created = await http.inject({
      method: "POST",
      url: "/campaigns",
      payload: { name: "Revisão", requiredPieces: ["video"] },
    });
    const campaignId = created.json().id as string;
    const base = `/campaigns/${campaignId}/pieces/video/versions`;

    const first = await http.inject({
      method: "POST",
      url: base,
      payload: { source: "v1.mp4", durationSeconds: 30 },
    });
    const firstId = first.json().id as string;

    const comment = await http.inject({
      method: "POST",
      url: `${base}/${firstId}/comments`,
      payload: { second: 4, text: "corta o silêncio" },
    });
    expect(comment.statusCode).toBe(201);
    expect(comment.json()).toMatchObject({ second: 4, text: "corta o silêncio" });

    const outside = await http.inject({
      method: "POST",
      url: `${base}/${firstId}/comments`,
      payload: { second: 31, text: "passou" },
    });
    expect(outside.statusCode).toBe(422);

    const second = await http.inject({
      method: "POST",
      url: base,
      payload: { source: "v2.mp4", durationSeconds: 30 },
    });
    const secondId = second.json().id as string;

    const history = await http.inject({ method: "GET", url: base });
    expect(history.json().map((version: { number: number }) => version.number)).toEqual([1, 2]);

    const original = await http.inject({ method: "GET", url: `${base}/${firstId}` });
    const replacement = await http.inject({ method: "GET", url: `${base}/${secondId}` });

    expect(original.json().comments).toEqual([
      expect.objectContaining({ second: 4, text: "corta o silêncio" }),
    ]);
    expect(replacement.json().comments).toEqual([]);
    expect(replacement.json().number).toBe(2);
  });

  it("peça não pedida não entra no erro de aprovação", async () => {
    const http = createApp();
    const created = await http.inject({
      method: "POST",
      url: "/campaigns",
      payload: { name: "Sem capa", requiredPieces: ["video"] },
    });
    const campaignId = created.json().id as string;

    await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/capa/versions`,
      payload: { source: "capa-rascunho.png" },
    });
    const video = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/video/versions`,
      payload: { source: "ok.mp4", durationSeconds: 3 },
    });
    await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/pieces/video/versions/${video.json().id}/approve`,
    });

    const delivery = await http.inject({
      method: "POST",
      url: `/campaigns/${campaignId}/delivery/approve`,
    });

    expect(delivery.statusCode).toBe(200);
    expect(delivery.json().deliveryStatus).toBe("aprovada");
  });
});
