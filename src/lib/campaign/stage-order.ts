type StageWithSlug = { slug: string };

type CampaignManifestOrder = {
  stages?: Array<{ id?: unknown }>;
};

/** Preserve the stage sequence authored in the immutable campaign manifest. */
export function orderStagesByManifest<T extends StageWithSlug>(stages: T[], manifestJson: unknown): T[] {
  const manifest = manifestJson as CampaignManifestOrder | null;
  const ids = manifest?.stages?.map((stage) => stage.id).filter((id): id is string => typeof id === "string") ?? [];
  if (ids.length === 0) return [...stages];

  const rank = new Map(ids.map((id, index) => [id, index]));
  return stages
    .map((stage, index) => ({ stage, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.stage.slug);
      const rightRank = rank.get(right.stage.slug);
      if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
      if (leftRank !== undefined) return -1;
      if (rightRank !== undefined) return 1;
      return left.index - right.index;
    })
    .map(({ stage }) => stage);
}
