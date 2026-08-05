/**
 * What a runner is actually handed.
 *
 * This type is the contract between the gateway and `app-runner`, and it did
 * not exist: the route returned the raw collab documents — `{ runner: {…},
 * httpServices, image_id, … }` — while the runner expected `machine_id`,
 * `imageRef`, `settings` and `capabilities` at the top level. Both sides were
 * tested, each against its own idea of the shape, and neither test could see
 * the other. Every placement was refused with "Placement names no machine",
 * and would have been unstartable even if it had not been.
 *
 * Kept here rather than imported from `app-runner`: the gateway must not
 * depend on the runner, and a runner in another language would read this
 * document rather than a TypeScript type. `TPlacement` in
 * `app-runner/src/lib/placement.ts` is the same shape, read from the outside.
 */
export type TRunnerPlacement = {
  /** Which machine this is for. Refused by the runner when absent. */
  machine_id: string;
  project_id: string;
  user_container_id: string;
  /** The container name the runner creates and later recognises. */
  name: string;
  /** Fully qualified image reference, resolved here rather than by the runner. */
  imageRef: string;
  /** Base64 `SETTINGS` blob — the container's entire configuration channel. */
  settings: string;
  capabilities: string[];
  devices: string[];
  extraHosts: { host: string; ip: string }[];
  /**
   * Private networks this container belongs to, by name.
   *
   * Empty for a local placement today: private network allocation is the
   * broker's, and nothing allocates one for a container running on somebody's
   * own machine. Stated rather than omitted, because the runner reconciles
   * against this list — an absent field and an empty one would mean the same
   * thing to it, and only one of them is true.
   */
  networks: string[];
};
