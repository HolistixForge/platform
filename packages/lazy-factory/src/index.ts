import {
  EComponentMode,
  ComponentProps,
  TLibrary,
  TComponentDeclaration,
} from './lib/types';

import factory from './lib/lazy-factory';
export * from './lib/lazy-factory';
export default factory;
export * from './lib/init';

export type { EComponentMode, ComponentProps, TLibrary, TComponentDeclaration };
