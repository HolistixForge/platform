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
