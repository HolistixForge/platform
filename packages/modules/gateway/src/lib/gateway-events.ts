export type TEventLoad = {
  type: 'gateway:load';
};

export type TEventDisableShutdown = {
  type: 'gateway:disable-shutdown';
};

export type TGatewayEvents = TEventLoad | TEventDisableShutdown;
