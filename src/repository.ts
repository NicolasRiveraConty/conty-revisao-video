import type { Campaign, PieceType, Version } from "./domain/model.js";

export interface Repository {
  saveCampaign(campaign: Campaign): void;
  getCampaign(id: string): Campaign | undefined;
  saveVersion(version: Version): void;
  getVersion(id: string): Version | undefined;
  listCampaignVersions(campaignId: string): Version[];
  listPieceVersions(campaignId: string, piece: PieceType): Version[];
}

export class MemoryRepository implements Repository {
  private readonly campaigns = new Map<string, Campaign>();
  private readonly versions = new Map<string, Version>();

  saveCampaign(campaign: Campaign): void {
    this.campaigns.set(campaign.id, structuredClone(campaign));
  }

  getCampaign(id: string): Campaign | undefined {
    const campaign = this.campaigns.get(id);
    return campaign ? structuredClone(campaign) : undefined;
  }

  saveVersion(version: Version): void {
    this.versions.set(version.id, structuredClone(version));
  }

  getVersion(id: string): Version | undefined {
    const version = this.versions.get(id);
    return version ? structuredClone(version) : undefined;
  }

  listCampaignVersions(campaignId: string): Version[] {
    return [...this.versions.values()]
      .filter((version) => version.campaignId === campaignId)
      .sort((a, b) => a.piece.localeCompare(b.piece) || a.number - b.number)
      .map((version) => structuredClone(version));
  }

  listPieceVersions(campaignId: string, piece: PieceType): Version[] {
    return this.listCampaignVersions(campaignId).filter((version) => version.piece === piece);
  }
}
