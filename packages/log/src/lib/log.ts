import { TJson } from '@monorepo/simple-types';

//
//

export enum EPriority {
  Emergency = 0,
  Alert = 1,
  Critical = 1,
  Error = 3,
  Warning = 4,
  Notice = 5,
  Info = 6,
  Debug = 7,
}

//
//

export enum EColor {
  Reset = '\x1b[0m',

  Bright = '\x1b[1m',
  Dim = '\x1b[2m',
  Underscore = '\x1b[4m',
  Blink = '\x1b[5m',
  Reverse = '\x1b[7m',
  Hidden = '\x1b[8m',

  FgBlack = '\x1b[30m',
  FgRed = '\x1b[31m',
  FgGreen = '\x1b[32m',
  FgYellow = '\x1b[33m',
  FgBlue = '\x1b[34m',
  FgMagenta = '\x1b[35m',
  FgCyan = '\x1b[36m',
  FgWhite = '\x1b[37m',
  FgGray = '\x1b[90m',

  BgBlack = '\x1b[40m',
  BgRed = '\x1b[41m',
  BgGreen = '\x1b[42m',
  BgYellow = '\x1b[43m',
  BgBlue = '\x1b[44m',
  BgMagenta = '\x1b[45m',
  BgCyan = '\x1b[46m',
  BgWhite = '\x1b[47m',
  BgGray = '\x1b[100m',
}

//
//

const isBrowser = new Function(
  'try {return this===window;}catch(e){ return false;}'
);

export class Logger {
  log(
    p: EPriority,
    category: string,
    msg: string,
    data?: TJson,
    color: EColor = EColor.Reset
  ): void {
    const l = `${new Date().toISOString()} [${p}] [${category}] --- ${msg}`;

    if (isBrowser()) {
      console.log(l, data || ' ');
    } else {
      console.log(
        `${color}%s %s\x1b[0m`,
        l,
        data ? JSON.stringify(data, null, 2) : ' '
      );
    }
  }

  error(category: string, msg: string, data?: TJson): void {
    this.log(3, category, msg, data, EColor.FgRed);
  }

  //

  static _logger: Logger = new Logger();
  static _priority: EPriority =
    process.env['LOG_LEVEL'] !== undefined
      ? parseInt(process.env['LOG_LEVEL'])
      : process.env['NODE_ENV'] !== 'development'
      ? 6
      : 7;

  static setLogger(logger: Logger): void {
    Logger._logger = logger;
  }

  static setPriority(p: EPriority): void {
    Logger._priority = p;
  }

  static log(
    p: EPriority,
    category: string,
    msg: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any,
    color?: EColor
  ) {
    if (p <= Logger._priority)
      Logger._logger.log(p, category, msg, data, color);
  }

  static error(category: string, msg: string, data?: TJson) {
    Logger._logger.error(category, msg, data);
  }
}

export const log = Logger.log;
export const error = Logger.error;
