export const ACCOUNT_STATUSES = ["active", "inactive"] as const;
export const USER_ROLES = ["banned", "user", "superuser", "admin", "owner"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export function canReview(role: UserRole): boolean {
  return role === "admin" || role === "owner";
}

export function signInBlock(status: AccountStatus, role: UserRole): string | null {
  if (role === "banned") return "This account is banned.";
  if (status !== "active") return "This account is inactive.";
  return null;
}

export function statusLabel(status: AccountStatus): string {
  return status === "active" ? "Active" : "Inactive";
}

export function roleLabel(role: UserRole): string {
  if (role === "superuser") return "Superuser";
  if (role === "admin") return "Admin";
  if (role === "owner") return "Owner";
  if (role === "banned") return "Banned";
  return "User";
}
