import { FC } from 'react';

type EComponentMode = 'THREE' | 'DOM';

type ComponentProps = {
  mode?: EComponentMode | null;
  _factoryError?: Error;
  _acceptedMode?: Array<EComponentMode>;
};

type TFactoryComponent = FC<ComponentProps & any>;

type TScript = {
  url?: string;
  code?: string;
  async: boolean;
};

type TComponentDeclaration = {
  name: string;
  ['THREE']?: TFactoryComponent;
  ['DOM']?: TFactoryComponent;
  scripts?: Array<TScript>;
};

type TLibrary = {
  name: string;
  description: string;
  author: string;
  components: Array<TComponentDeclaration>;
  _initp?: Promise<TLibrary> | null;
};

export type {
  TScript,
  EComponentMode,
  TLibrary,
  TComponentDeclaration,
  TFactoryComponent,
  ComponentProps,
};
