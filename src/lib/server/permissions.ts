// The Astro-based Wix CLI has no web methods. Service functions keep their
// original permission labels as documentation; each caller (HTTP endpoint,
// tools provider) is responsible for authorizing the request before calling.
export enum Permissions {
  Anyone = 'Anyone',
  SiteMember = 'SiteMember',
  Admin = 'Admin',
}

export function webMethod<T extends (...args: any[]) => any>(_permission: Permissions, fn: T): T {
  return fn;
}
