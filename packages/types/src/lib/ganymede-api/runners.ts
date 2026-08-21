/**
 * A machine the caller has enrolled, as `GET /runners` returns it.
 *
 * Distinct from `TRunnerMachine` in the collab document, and the difference is
 * load-bearing. That one is the machines whose runner is already heartbeating
 * *into a given project*; this one is every machine its owner enrolled,
 * anywhere. A machine's **first** placement is what puts it in a project, so a
 * picker fed from the project's catalogue could never offer a machine that had
 * not already joined — and none ever would.
 *
 * Revoked machines are included, and marked. Hiding one makes a revocation look
 * like a deletion, and the owner is the person who needs to know which it was.
 */
export type TApi_Runner = {
  runner_id: string;
  label: string;
  created_at: string;
  /**
   * Stamped on every authenticated request the runner makes, in the same
   * statement that authenticates it (`func_runners_touch`). A runner polls on
   * its interval — 15 s by default — so this trails liveness by at most one
   * pass, and null means it has never called since enrolling.
   */
  last_seen_at: string | null;
  /** Set when the machine was disconnected. Null while it is still enrolled. */
  revoked_at: string | null;
};
