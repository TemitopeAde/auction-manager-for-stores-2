export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : 'Request failed.';
  return json({ error: message }, status);
}
