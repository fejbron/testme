export type OverviewSearchRow = {
  student: { name: string; email: string };
  campaign: string;
  environment: string;
  hintsUsed: number;
  failedSubmissions: number;
};

export function needsAttention(row: OverviewSearchRow): boolean {
  return row.environment === "ERROR" || row.environment === "STOPPED" || row.hintsUsed > 1 || row.failedSubmissions > 2;
}

export function filterOverviewRows<T extends OverviewSearchRow>(rows: T[], query: string, campaign: string, attentionOnly = false): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const matchesQuery = !normalized || [row.student.name, row.student.email, row.campaign].some((value) => value.toLocaleLowerCase().includes(normalized));
    const matchesCampaign = campaign === "all" || row.campaign === campaign;
    return matchesQuery && matchesCampaign && (!attentionOnly || needsAttention(row));
  });
}
