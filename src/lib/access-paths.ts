export function isManagementOnlyPath(pathname: string) {
  if (
    pathname.startsWith("/burndown") ||
    pathname.startsWith("/colaboradores") ||
    pathname.startsWith("/clientes") ||
    pathname.startsWith("/historico")
  ) {
    return true;
  }
  return /^\/projetos\/[^/]+$/.test(pathname);
}
