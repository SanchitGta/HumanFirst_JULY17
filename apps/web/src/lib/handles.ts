// Next.js resolves static routes before dynamic segments, so a handle matching
// one of these would permanently shadow the corresponding static route.
export const RESERVED_HANDLES = [
  "blog",
  "login",
  "register",
  "api",
  "settings",
  "dashboard",
  "_next",
];

const HANDLE_PATTERN = /^[a-z0-9-]{3,30}$/;

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.includes(handle);
}

export function slugifyHandle(nameOrEmail: string): string {
  const base = nameOrEmail.split("@")[0] ?? nameOrEmail;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}
