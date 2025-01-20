import {
  ChangeEvent,
  DependencyList,
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { TFormErrors } from '../form/form-errors/types';
import { standardizeError } from '../form/form-errors/error-utils';
import { useTimer } from '../nodes/node-chat/use-timer';

/**
 * Need to add in 'eslintrc.json':
 * {
 *   "rules": {
 *     "react-hooks/exhaustive-deps": [
 *       "warn",
 *       {
 *         "additionalHooks": "(useAction)"
 *       }
 *     ]
 *   }
 * }
 * @param callback
 * @param deps
 * @returns
 */

export type TAction<TCallbackArg = MouseEvent<HTMLElement>> = {
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (a: TCallbackArg, origin?: string) => void;
  errors: TFormErrors;
  isOpened: boolean;
  disabled: boolean;
  open: () => void;
  close: () => void;
  formData: TCallbackArg;
  handleInputChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  handleChange: (d: Partial<TCallbackArg>) => void;
  actionOrigin?: string;
  successMessage?: ReactNode;
  tooltip?: ReactNode;
};

//

type TState<T> = Pick<
  TAction<T>,
  | 'formData'
  | 'loading'
  | 'errors'
  | 'isOpened'
  | 'disabled'
  | 'actionOrigin'
  | 'successMessage'
> & { rearm: (timeout: number) => void };

type TActions<T> =
  | { type: 'start'; actionOrigin?: string }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'clear' }
  | {
      type: 'set-form-data';
      data: Partial<T>;
    }
  | {
      type: 'stop';
      errors?: TFormErrors;
      errorLatchTime?: number;
      reset: boolean;
      close: boolean;
      actionOrigin?: string;
      successMessage?: ReactNode;
    }
  | { type: 'disable' };

const reducer = <T>(state: TState<T>, action: TActions<T>): TState<T> => {
  switch (action.type) {
    case 'clear':
      state.errors = {};
      state.successMessage = undefined;
      return { ...state };

    case 'open':
      state.isOpened = true;
      return { ...state };

    case 'close':
      state.isOpened = false;
      return { ...state };

    case 'disable':
      state.disabled = true;
      return { ...state };

    case 'start':
      state.loading = true;
      state.actionOrigin = action.actionOrigin;
      state.successMessage = undefined;
      return { ...state };

    case 'set-form-data':
      state.formData = { ...state.formData, ...action.data };
      return { ...state };

    case 'stop':
      state.loading = false;
      if (action.errors && Object.keys(action.errors).length > 0) {
        state.errors = action.errors;
      } else state.errors = {};
      if (action.errorLatchTime && action.errorLatchTime !== -1)
        state.rearm(action.errorLatchTime);
      if (action.reset) state.formData = {} as T;
      if (action.close) state.isOpened = false;
      state.actionOrigin = action.actionOrigin;
      state.successMessage = action.successMessage;
      return { ...state };

    default:
      return state;
  }
};

//
//
//

type TActionMethods<TCallbackArg> = {
  open: () => void;
  close: () => void;
  disable: () => void;
  handleInputChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  handleChange: (data: Partial<TCallbackArg>) => void;
};

export function useAction<TCallbackArg = MouseEvent<HTMLElement>>(
  cb: (
    data: TCallbackArg,
    methods: TActionMethods<TCallbackArg>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>,
  deps: DependencyList,
  options?: {
    errorLatchTime?: number; // ms
    checkForm?: (d: TCallbackArg, e: TFormErrors<TCallbackArg>) => void;
    values?: Partial<TCallbackArg>;
    /** must reset data if callback succeed ? default true */
    resetOnSuccess?: boolean;
    /** close eventual Dialog on success ? default true */
    closeOnSuccess?: boolean;
    successMessage?: ReactNode;
    tooltip?: ReactNode;
  },
): TAction<TCallbackArg> {
  //

  const { rearm } = useTimer(() => dispatch({ type: 'clear' }), []);

  const [state, dispatch] = useReducer(reducer<TCallbackArg>, {
    errors: {},
    loading: false,
    isOpened: false,
    disabled: false,
    formData: (options?.values ? options.values : {}) as TCallbackArg,
    rearm,
  });

  // update existing form values when necessary
  const valuesChange = JSON.stringify(options?.values);
  useEffect(() => {
    if (options?.values) {
      dispatch({
        type: 'set-form-data',
        data: options.values,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesChange]);

  const m = useMemo(
    () => ({
      open: () => dispatch({ type: 'open' }),

      close: () => dispatch({ type: 'close' }),

      disable: () => {
        dispatch({ type: 'disable' });
      },

      handleInputChange: (
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
      ) => {
        const { name, value } = e.target;
        dispatch({
          type: 'set-form-data',
          data: {
            [name]: value,
          } as Partial<TCallbackArg>,
        });
      },

      handleChange: (data: Partial<TCallbackArg>) => {
        dispatch({
          type: 'set-form-data',
          data,
        });
      },
    }),
    [],
  );

  const callback = useCallback(
    (data: TCallbackArg, actionOrigin?: string) => {
      dispatch({ type: 'start', actionOrigin });

      if (options?.checkForm) {
        const ne: TFormErrors<TCallbackArg> = {};
        options.checkForm(data, ne);
        if (Object.keys(ne).length > 0) {
          dispatch({
            type: 'stop',
            errors: ne,
            errorLatchTime: options?.errorLatchTime || -1,
            reset: false,
            close: false,
            actionOrigin,
          });
          return;
        }
      }

      cb(data, m)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((v: any) => {
          dispatch({
            type: 'stop',
            reset:
              options?.resetOnSuccess !== undefined
                ? options.resetOnSuccess
                : true,
            close:
              options?.closeOnSuccess !== undefined
                ? options.closeOnSuccess
                : true,
            actionOrigin,
            successMessage: options?.successMessage,
            errorLatchTime: options?.errorLatchTime || -1,
          });
          return v;
        })
        .catch((e) => {
          const fe = standardizeError(e);
          dispatch({
            type: 'stop',
            errors: fe || undefined,
            errorLatchTime: options?.errorLatchTime || -1,
            reset: false,
            close: false,
            actionOrigin,
          });
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...deps, options],
  );

  return {
    ...state,
    ...m,
    tooltip: options?.tooltip,
    callback,
  };
}
