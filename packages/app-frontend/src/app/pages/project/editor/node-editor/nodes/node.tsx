import factory from '@monorepo/lazy-factory';

// TODO: compile error if import path is not calculated,
// does it still lazy load ?
factory.setLibraries({
  socials: () =>
    import(
      /* webpackChunkName: "lazy-factory-lib-social-embeds" */
      `@monorepo/${'social-embeds'}`
    ).then((l) => l.default),
});
