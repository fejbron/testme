export type SearchableAdminUser = {
  displayName: string;
  email: string;
  role: string;
};

export function filterAdminUsers<T extends SearchableAdminUser>(users: T[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return users;
  return users.filter((user) =>
    [user.displayName, user.email, user.role].some((value) =>
      value.toLocaleLowerCase().includes(normalized)
    )
  );
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}
