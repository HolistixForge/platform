import { TJsonObject } from '@holistix-forge/simple-types';
import { log, EPriority } from '@holistix-forge/log';
import { ContainerRunner, TRunnerConfig } from './runner';
import { ContainerImageRegistry } from './image-registry';
import { TUserContainer } from './servers-types';

export class LocalRunnerBackend extends ContainerRunner {
  async start(
    container: TUserContainer,
    jwtToken: string,
    imageRegistry: ContainerImageRegistry,
    config: TRunnerConfig
  ): Promise<TJsonObject> {
    const command = this.generateCommand(
      container,
      jwtToken,
      imageRegistry,
      config
    );

    log(
      EPriority.Info,
      'LOCAL_RUNNER',
      `Generated docker command for container ${container.user_container_id}`
    );

    return { command };
  }
}

export const localRunnerBackend = new LocalRunnerBackend();
