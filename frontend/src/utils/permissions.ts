export function hasPermission(permissions: readonly string[], required: string) {
  return permissions.includes(required);
}
