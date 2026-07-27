export function GET(request: Request) {
  return Response.redirect(new URL("/dossier/read/white-dossier", request.url), 308);
}
