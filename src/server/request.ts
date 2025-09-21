export const withForwardedFor = (request: Request): Headers => {
  const headers = new Headers(request.headers);
  if (!headers.has('x-forwarded-for')) {
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for') ||
      '127.0.0.1';
    headers.set('x-forwarded-for', ip);
  }
  return headers;
};
