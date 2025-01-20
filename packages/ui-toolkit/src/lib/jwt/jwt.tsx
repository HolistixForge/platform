export function b64_to_utf8(str: string) {
  return decodeURIComponent(escape(window.atob(str)));
}

export function JwtPayload(token: string) {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    const decoded = b64_to_utf8(payload);
    const json = JSON.parse(decoded);
    return json;
  } catch (e) {
    console.error('invalid JWT');
    return null;
  }
}
