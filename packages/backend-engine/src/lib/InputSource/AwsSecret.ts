import { Request } from '../Request/Request';
import { InputSource } from './InputSource';
import {
  GetSecretValueCommandOutput,
  SecretsManager,
} from '@aws-sdk/client-secrets-manager';
import { ConfigException } from '../Exceptions/Exception';
import { TJson } from '@monorepo/simple-types';

export class Current extends InputSource {
  get types() {
    return ['aws-secret'];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(type: string, id: string[], r?: Request): Promise<TJson> {
    switch (type) {
      case 'aws-secret':
        return await new Promise((resolve, reject) => {
          const secretsmanager = new SecretsManager({});

          const params = {
            VersionStage: 'AWSCURRENT',
            SecretId: id[0],
          };

          secretsmanager.getSecretValue(
            params,
            function (err: any, data: GetSecretValueCommandOutput | undefined) {
              if (err || !data) reject(new ConfigException(err.message));
              else resolve(JSON.parse(data.SecretString as string));
            }
          );
        });
    }
    return Promise.reject('invalid secret type');
  }
}
