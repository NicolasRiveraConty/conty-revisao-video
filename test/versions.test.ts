import { describe, expect, it } from "vitest";
import { AppError } from "../src/domain/errors.js";
import { MemoryRepository } from "../src/repository.js";
import { CampaignService } from "../src/service.js";

function serviceWithVideoCampaign(requiredPieces: Array<"roteiro" | "video" | "capa" | "legenda"> = ["video"]) {
  const service = new CampaignService(new MemoryRepository());
  const campaign = service.createCampaign({ name: "Verão", requiredPieces });
  return { service, campaign };
}

describe("versões e comentários", () => {
  it("nova versão substitui a anterior sem apagá-la", () => {
    const { service, campaign } = serviceWithVideoCampaign();
    const first = service.addVersion(campaign.id, "video", {
      source: "corte-v1.mp4",
      durationSeconds: 20,
    });
    const second = service.addVersion(campaign.id, "video", {
      source: "https://exemplo/corte-v2.mp4",
      durationSeconds: 24,
    });

    const versions = service.listVersions(campaign.id, "video");

    expect(versions.map((version) => version.number)).toEqual([1, 2]);
    expect(versions.map((version) => version.id)).toEqual([first.id, second.id]);
    expect(service.getCampaign(campaign.id).pieces.video?.current?.id).toBe(second.id);
    expect(service.getVersion(campaign.id, "video", first.id).source).toBe("corte-v1.mp4");
  });

  it("comentário fica no segundo da versão em que foi feito e não migra", () => {
    const { service, campaign } = serviceWithVideoCampaign();
    const first = service.addVersion(campaign.id, "video", {
      source: "corte-v1.mp4",
      durationSeconds: 20,
    });
    const comment = service.addComment(campaign.id, "video", first.id, {
      second: 8,
      text: "segura o produto",
    });
    const second = service.addVersion(campaign.id, "video", {
      source: "corte-v2.mp4",
      durationSeconds: 20,
    });

    const original = service.getVersion(campaign.id, "video", first.id);
    const replacement = service.getVersion(campaign.id, "video", second.id);

    expect(original.comments).toEqual([comment]);
    expect(original.comments[0]).toMatchObject({ second: 8, text: "segura o produto" });
    expect(replacement.comments).toEqual([]);
  });

  it("rejeita comentário depois do fim quando a versão tem duração", () => {
    const { service, campaign } = serviceWithVideoCampaign();
    const version = service.addVersion(campaign.id, "video", {
      source: "corte.mp4",
      durationSeconds: 10,
    });

    expect(() =>
      service.addComment(campaign.id, "video", version.id, { second: 10.1, text: "tarde demais" }),
    ).toThrow(AppError);

    try {
      service.addComment(campaign.id, "video", version.id, { second: 10.1, text: "tarde demais" });
    } catch (error) {
      expect((error as AppError).statusCode).toBe(422);
      expect((error as AppError).message).toContain("10.1");
    }

    const onTheEdge = service.addComment(campaign.id, "video", version.id, {
      second: 10,
      text: "no último instante",
    });
    expect(onTheEdge.second).toBe(10);
  });

  it("aceita o segundo quando a versão não informa duração", () => {
    const { service, campaign } = serviceWithVideoCampaign();
    const version = service.addVersion(campaign.id, "video", { source: "sem-duracao.mp4" });

    const comment = service.addComment(campaign.id, "video", version.id, {
      second: 40,
      text: "sem teto conhecido",
    });

    expect(comment.second).toBe(40);
  });

  it("não aprova a versão que já foi substituída", () => {
    const { service, campaign } = serviceWithVideoCampaign();
    const first = service.addVersion(campaign.id, "video", { source: "v1.mp4", durationSeconds: 5 });
    const second = service.addVersion(campaign.id, "video", { source: "v2.mp4", durationSeconds: 5 });

    expect(() => service.approveVersion(campaign.id, "video", first.id)).toThrow(AppError);
    try {
      service.approveVersion(campaign.id, "video", first.id);
    } catch (error) {
      expect((error as AppError).statusCode).toBe(409);
      expect((error as AppError).message).toContain("versão 2");
    }

    expect(service.approveVersion(campaign.id, "video", second.id).status).toBe("aprovada");
  });

  it("entrega aprovada volta para produção quando a peça exigida ganha versão nova", () => {
    const { service, campaign } = serviceWithVideoCampaign(["video", "legenda"]);
    const video = service.addVersion(campaign.id, "video", { source: "v1.mp4", durationSeconds: 5 });
    const caption = service.addVersion(campaign.id, "legenda", { source: "legenda.txt" });
    service.approveVersion(campaign.id, "video", video.id);
    service.approveVersion(campaign.id, "legenda", caption.id);
    expect(service.approveDelivery(campaign.id).deliveryStatus).toBe("aprovada");

    service.addVersion(campaign.id, "video", { source: "v2.mp4", durationSeconds: 5 });

    expect(service.getCampaign(campaign.id).deliveryStatus).toBe("em_producao");
    expect(() => service.approveDelivery(campaign.id)).toThrow(AppError);
  });

  it("versão nova de peça não exigida não reabre a entrega", () => {
    const { service, campaign } = serviceWithVideoCampaign(["video"]);
    const video = service.addVersion(campaign.id, "video", { source: "v1.mp4", durationSeconds: 5 });
    service.approveVersion(campaign.id, "video", video.id);
    service.approveDelivery(campaign.id);

    service.addVersion(campaign.id, "capa", { source: "capa.png" });

    expect(service.getCampaign(campaign.id).deliveryStatus).toBe("aprovada");
    expect(service.approveDelivery(campaign.id).deliveryStatus).toBe("aprovada");
  });
});
