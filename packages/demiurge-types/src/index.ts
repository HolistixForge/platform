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

export {
  USER_SCOPE,
  GATEWAY_SCOPE,
  GATEWAY_PROJECT_SCOPE,
  makeProjectScopeString,
  makeGatewayScopeString,
  userContainerAccessScope,
  GLOBAL_CLIENT_ID,
  GLOBAL_CLIENT_SECRET,
} from './lib/ganymede-api/scope';
export type { TScope } from './lib/ganymede-api/scope';

export type {
  TJwtUserContainer,
  TJwtProject,
  TJwtGateway,
  TJwtUser,
} from './lib/jwt/jwt';
