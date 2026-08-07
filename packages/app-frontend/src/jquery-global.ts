/**
 * jQuery on the window, before anything that reads it is evaluated.
 *
 * The Jupyter module reaches `@jupyter-widgets/controls`, which ships a
 * jQuery-UI slider that reads the global *while its module is being evaluated*
 * — not when a widget is used. The packages are built for webpack, where a
 * ProvidePlugin supplies it. Vite supplies nothing, so the reference throws
 * before React mounts and the application renders a blank page:
 * "ReferenceError: jQuery is not defined", raised from `requireSlider`.
 *
 * A module of its own, and not two lines at the top of `main.tsx`, because ES
 * imports are hoisted: every import in a file is evaluated before any statement
 * in it, so an assignment written first still runs last. Import order *between*
 * modules is honoured, which is why this works and that did not — measured,
 * with the same error from the same frame.
 */
import jquery from 'jquery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).jQuery = jquery;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).$ = jquery;
