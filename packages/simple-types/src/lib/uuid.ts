import { v4 } from 'uuid';

/**
 *
 * @returns
 */
export const makeUuid = () => v4();

/**
 * make a 32 bits, 8 hexadecimal string uuid
 * @returns string: short uuid
 */
export const makeShortUuid = () => makeUuid().substring(0, 8);

export const isUuid = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

//

export const toUuid = (uuid: string) => {
  if (isUuid(uuid)) {
    return uuid;
  } else if (/^[0-9a-f]{32}$/i.test(uuid))
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(
      12,
      16
    )}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
  return false;
};
