export const GLOBAL_CLIENT_ID = 'app-main-client-id';
export const GLOBAL_CLIENT_SECRET = 'none';

// The local runner. A public client: it runs on someone's machine, so it holds
// no secret and proves itself with PKCE instead. There is deliberately no
// RUNNER_CLIENT_SECRET to go with this.
export const RUNNER_CLIENT_ID = 'holistix-runner';
