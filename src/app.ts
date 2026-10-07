import Fastify, { type FastifyInstance } from "fastify";
import { AppError } from "./domain/errors.js";
import { CampaignService } from "./service.js";

export function buildApp(service: CampaignService): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.message,
        ...error.details,
      });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "Erro interno." });
  });

  app.post("/campaigns", async (request, reply) => {
    const body = asRecord(request.body);
    const campaign = service.createCampaign({
      name: body.name,
      requiredPieces: body.requiredPieces,
    });
    return reply.code(201).send(campaign);
  });

  app.get("/campaigns/:campaignId", async (request) => {
    const { campaignId } = request.params as { campaignId: string };
    return service.getCampaign(campaignId);
  });

  app.post("/campaigns/:campaignId/pieces/:piece/versions", async (request, reply) => {
    const { campaignId, piece } = request.params as { campaignId: string; piece: string };
    const body = asRecord(request.body);
    const version = service.addVersion(campaignId, piece, {
      source: body.source,
      durationSeconds: body.durationSeconds,
    });
    return reply.code(201).send(version);
  });

  app.get("/campaigns/:campaignId/pieces/:piece/versions", async (request) => {
    const { campaignId, piece } = request.params as { campaignId: string; piece: string };
    return service.listVersions(campaignId, piece);
  });

  app.get("/campaigns/:campaignId/pieces/:piece/versions/:versionId", async (request) => {
    const { campaignId, piece, versionId } = request.params as {
      campaignId: string;
      piece: string;
      versionId: string;
    };
    return service.getVersion(campaignId, piece, versionId);
  });

  app.post(
    "/campaigns/:campaignId/pieces/:piece/versions/:versionId/comments",
    async (request, reply) => {
      const { campaignId, piece, versionId } = request.params as {
        campaignId: string;
        piece: string;
        versionId: string;
      };
      const body = asRecord(request.body);
      const comment = service.addComment(campaignId, piece, versionId, {
        second: body.second,
        text: body.text,
      });
      return reply.code(201).send(comment);
    },
  );

  app.post("/campaigns/:campaignId/pieces/:piece/versions/:versionId/approve", async (request) => {
    const { campaignId, piece, versionId } = request.params as {
      campaignId: string;
      piece: string;
      versionId: string;
    };
    return service.approveVersion(campaignId, piece, versionId);
  });

  app.post("/campaigns/:campaignId/delivery/approve", async (request) => {
    const { campaignId } = request.params as { campaignId: string };
    return service.approveDelivery(campaignId);
  });

  return app;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}
