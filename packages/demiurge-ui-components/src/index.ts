import './lib/assets/css/index.scss';

export { Accordion } from './lib/accordion/Accordion';
export { LiveSpace } from './lib/liveSpace/liveSpace';
export { Preview } from './lib/preview/Preview';

export type { TAction } from './lib/buttons/useAction';
export { useAction } from './lib/buttons/useAction';
export { ButtonBase } from './lib/buttons/buttonBase';
export type { ButtonBaseProps } from './lib/buttons/buttonBase';
export { ButtonIcon } from './lib/buttons/buttonIcon';
export type { ButtonIconProps } from './lib/buttons/buttonIcon';
export { ResourceButtons } from './lib/buttons/resource-buttons';

export { UsersScopes } from './lib/users-scopes/users-scopes';
export type {
  UsersScopesLogicProps,
  UsersScopesProps,
} from './lib/users-scopes/users-scopes';

export { WrapperCssCoordinates } from './lib/css-utils/wrapper-css-coordinates';
export {
  addAlphaToHexColor,
  randomColor,
  cssVar,
  getCssProperties,
  paletteRandomColor,
} from './lib/css-utils/css-utils';

/** Forms */
export type {
  TFormErrors,
  TFormSubmitHandler,
} from './lib/form/form-errors/types';
export { FormError, FormErrors } from './lib/form/form-errors/form-errors';
export { FormErrorsError } from './lib/form/form-errors/types';
export { standardizeError } from './lib/form/form-errors/error-utils';

export { SwitchFieldset } from './lib/form/form-fields/switch-fieldset';
export { TextFieldset } from './lib/form/form-fields/text-fieldset';
export {
  SelectFieldset,
  SelectItem,
} from './lib/form/form-fields/select-fieldset';

//

//

export { icons } from './lib/assets/icons';

export { Sidebar } from './lib/sidebar/Sidebar';

export { Countdown } from './lib/countdown/countdown';

export { UserInline, UserAvatar, UserUsername } from './lib/users/users';
export { UserBubble } from './lib/users/user-bubble';

export { DialogControlled } from './lib/dialog/dialog';

export { useTimer } from './lib/timer/use-timer';

export { Datetime } from './lib/datetime/datetime';

export {
  useTestBoolean,
  useNotImplemented,
  playAdd__hover,
} from './lib/storybook-utils';

export { randomGuy, randomGuys } from './lib/utils/random-guys';
export { ClickStopPropagation } from './lib/utils/click-stop-propagation';

export { LoadingDots } from './lib/indicators/loading-dots';

export { copyToClipboard } from './lib/utils/copy-to-clipboard';

export type { Tag } from './lib/tags/tags';
export { TagsBar } from './lib/tags/tags';
