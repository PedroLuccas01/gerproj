export function isManagementOnlyPath(pathname: string) {
  if (
    pathname.startsWith("/burndown") ||
    pathname.startsWith("/colaboradores") ||
    pathname.startsWith("/clientes")
  ) {
    return true;
  }
  return /^\/projetos\/[^/]+$/.test(pathname);
}
