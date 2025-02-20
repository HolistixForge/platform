export type TEventNewYoutube = {
  type: 'socials:new-youtube';
  videoId: string;
};

export type TEventDeleteYoutube = {
  type: 'socials:delete-youtube';
  nodeId: string;
};

export type TEventSocials = TEventNewYoutube | TEventDeleteYoutube;
