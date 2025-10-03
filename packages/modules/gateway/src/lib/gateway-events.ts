export type TEventLoad = {
  type: 'gateway:load';
};

export type TEventDisableShutdown = {
  type: 'gateway:disable-shutdown';
};

export type TEventPeriodic = {
  type: 'gateway:periodic';
};

export type TGatewayEvents =
  | TEventLoad
  | TEventDisableShutdown
  | TEventPeriodic;
