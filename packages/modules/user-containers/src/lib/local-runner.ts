import { ContainerRunner } from './runner';
import { TUserContainer } from './servers-types';

export class LocalRunnerBackend extends ContainerRunner {
  async start(container: TUserContainer, jwtToken: string): Promise<void> {
    console.log('Starting local container', container);
    // For local runner, the command would be generated using generateCommand
    // and returned to user or executed directly depending on implementation
    // Example:
    // const command = this.generateCommand(container, jwtToken, imageRegistry, config);
    // console.log('Docker command:', command);
  }
}

export const localRunnerBackend = new LocalRunnerBackend();


