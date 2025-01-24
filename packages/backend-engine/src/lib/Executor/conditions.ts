import { DeepReadonly } from 'ts-essentials';
import { EpDefinitionException } from '../Exceptions/Exception';
import { Inputs } from '../InputSource/Inputs';
import { Request } from '../Request/Request';

//
//

type TScalar = string | number | boolean;

type TCondition = {
  'is-truthy'?: boolean;
  'is-not-truthy'?: boolean;
  'is-not-undefined'?: boolean;
  is?: TScalar;
  'is-not'?: TScalar;
  in?: TScalar[];
};

export type TElse = {
  break?: {
    statusCode: number;
    message: string;
  };
};

export type TConditions = DeepReadonly<
  | ({ break?: boolean } & { else?: TElse })
  | {
      [k: string]: TCondition;
    }
>;

//
//

export const evalConditions = async (
  conditions: TConditions,
  inputs: Inputs,
  request?: Request
): Promise<boolean> => {
  for (const k in conditions) {
    if (k !== 'else') {
      const expect = conditions[k as keyof typeof conditions] as TCondition;
      const evaluatedValue = await inputs.cloneEvalArgs(k, request);

      if (typeof expect === 'object') {
        for (const conditionType in expect) {
          if (
            typeof evaluatedValue === 'object' &&
            ['is', 'is-not', 'in'].includes(conditionType)
          )
            throw new EpDefinitionException(
              `can't evaluate object ${evaluatedValue}`
            );

          const expectedValue = expect[conditionType as keyof TCondition];

          switch (conditionType) {
            case 'is-truthy':
              if (!evaluatedValue) return false;
              break;

            case 'is-not-truthy':
              if (evaluatedValue) return false;
              break;

            case 'is-not-undefined':
              if (evaluatedValue === undefined) return false;
              break;

            case 'is':
              if (evaluatedValue !== expectedValue) return false;
              break;

            case 'is-not':
              if (evaluatedValue === expectedValue) return false;
              break;

            case 'in':
              if (
                !(expectedValue as TScalar[]).includes(
                  evaluatedValue as TScalar
                )
              )
                return false;
              break;
          }
        }
      }
    }
  }

  return true;
};
