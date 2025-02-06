export type {
  TD_User,
  CurrentUserDetails,
  TG_User,
  TF_User,
  TCollaborator,
} from './lib/user';

//

export type {
  TApi_Project,
  TApi_Authorization,
} from './lib/ganymede-api/types';

export type {
  TNodeGeneric,
  TNodePython,
  TNodeMarkDown,
  TNodeVideo,
  TNodeTerminal,
  TNodeServer,
  TNodeKernel,
  TNodeVolume,
  TNodeChat,
  TNodeType,
  TNotebookNode,
} from './lib/node-types';

export { makeYjsDocId } from './lib/yjs/doc-id';

export {
  USER_SCOPE,
  GATEWAY_SCOPE,
  GATEWAY_PROJECT_SCOPE,
  makeProjectScopeString,
  makeGatewayScopeString,
  serverAccessScope,
  GLOBAL_CLIENT_ID,
  GLOBAL_CLIENT_SECRET,
} from './lib/ganymede-api/scope';
export type { TScope } from './lib/ganymede-api/scope';

export type {
  TJwtServer,
  TJwtProject,
  TJwtGateway,
  TJwtUser,
} from './lib/jwt/jwt';
