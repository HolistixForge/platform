import {
  _InstanceType,
  EC2,
  RunInstancesCommandInput,
} from '@aws-sdk/client-ec2';

import {
  Command,
  TCommandReturn,
  EC2Exception,
} from '@monorepo/backend-engine';
import { error, log, NotFoundException } from '@monorepo/log';
import { TD_Server, TEc2InstanceState } from '@monorepo/servers';

//

export class EC2InstanceManager {
  /**
   * Instantiate a new EC2 instance with a user-provided bash script, storage size, SSH key pair, and a name.
   * @param bashScript - The bash script to run on instance startup.
   * @param amiId - The ID of the AMI to use.
   * @param instanceType - The instance type (e.g., "t2.micro").
   * @param storageSize - The size of the root volume in GB.
   * @param sshKeyName - The name of the SSH key pair to use for instance access.
   * @param securityGroupId - The name of the security group to add to the instance.
   * @param name - The name of the instance.
   * @param region - The AWS region to launch the instance in.
   * @returns The ID of the created instance.
   */
  public async instantiate(
    bashScript: string,
    amiId: string,
    instanceType: string,
    storageSize: number,
    sshKeyName: string,
    securityGroupId: string,
    name: string,
    region: string
  ): Promise<string> {
    const params: RunInstancesCommandInput = {
      ImageId: amiId,
      InstanceType: instanceType as _InstanceType,
      MinCount: 1,
      MaxCount: 1,
      UserData: Buffer.from(bashScript).toString('base64'), // UserData must be base64-encoded
      BlockDeviceMappings: [
        {
          DeviceName: '/dev/sda1',
          Ebs: {
            VolumeSize: storageSize,
          },
        },
      ],
      KeyName: sshKeyName,
      SecurityGroupIds: [securityGroupId], // Add the security group to the instance
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            {
              Key: 'Name',
              Value: name,
            },
          ],
        },
      ],
    };

    try {
      const ec2Instance = new EC2({
        region: region,
      });
      const result = await ec2Instance.runInstances(params);
      const instanceId = result.Instances?.[0]?.InstanceId;

      if (!instanceId) {
        throw new Error('Failed to retrieve instance ID');
      }

      log(
        6,
        'EC2',
        `Instance created with ID: ${instanceId} and name: ${name}`
      );
      return instanceId;
    } catch (err: any) {
      error('EC2', 'Error creating instance:', err.message);
      throw new EC2Exception(err.message);
    }
  }

  /**
   * Start an existing EC2 instance.
   * @param instanceId - The ID of the instance to start.
   */
  public async start(instanceId: string, region: string): Promise<void> {
    try {
      const ec2 = new EC2({
        region: region,
      });
      await ec2.startInstances({ InstanceIds: [instanceId] });
      log(6, 'EC2', `Instance ${instanceId} started.`);
    } catch (err: any) {
      error('EC2', `Error starting instance ${instanceId}:`, err);
      throw new EC2Exception(err.message);
    }
  }

  /**
   * Pause (stop) an EC2 instance.
   * @param instanceId - The ID of the instance to stop.
   */
  public async pause(instanceId: string, region: string): Promise<void> {
    try {
      const ec2 = new EC2({
        region: region,
      });
      await ec2.stopInstances({ InstanceIds: [instanceId] });
      log(6, 'EC2', `Instance ${instanceId} stopped.`);
    } catch (err: any) {
      error('EC2', `Error stopping instance ${instanceId}:`, err);
      throw new EC2Exception(err.message);
    }
  }

  /**
   * Delete (terminate) an EC2 instance.
   * @param instanceId - The ID of the instance to terminate.
   */
  public async delete(instanceId: string, region: string): Promise<void> {
    try {
      const ec2 = new EC2({
        region: region,
      });
      await ec2.terminateInstances({ InstanceIds: [instanceId] });
      log(6, 'EC2', `Instance ${instanceId} terminated.`);
    } catch (err: any) {
      error('EC2', `Error terminating instance ${instanceId}:`, err);
      throw new EC2Exception(err.message);
    }
  }
  /**
   * Get the state of an EC2 instance.
   * @param instanceId - The ID of the instance to get the state of.
   * @param region - The region where the instance is located.
   * @returns The state of the instance.
   */
  public async getInstanceState(
    instanceId: string,
    region: string
  ): Promise<TEc2InstanceState> {
    try {
      const ec2 = new EC2({
        region: region,
      });

      const result = await ec2.describeInstances({ InstanceIds: [instanceId] });
      const instanceState =
        result.Reservations?.[0]?.Instances?.[0]?.State?.Name;

      if (!instanceState) {
        throw new Error(
          `Failed to retrieve state for instance ${instanceId} in region ${region}`
        );
      }

      log(
        6,
        'EC2',
        `Instance ${instanceId} in region ${region} state: ${instanceState}`
      );
      return instanceState;
    } catch (err: any) {
      error(
        'EC2',
        `Error getting state for instance ${instanceId} in region ${region}:`,
        err
      );
      throw new EC2Exception(err.message);
    }
  }
}

//

export class Ec2InstanceCreate extends Command {
  async run(args: {
    cmd: string;
    amiId: string;
    instanceType: string;
    storageSize: number;
    sshKeyName: string;
    securityGroupId: string;
    name: string;
    region: string;
  }): Promise<TCommandReturn> {
    const m = new EC2InstanceManager();
    const instanceId = await m.instantiate(
      args.cmd,
      args.amiId,
      args.instanceType,
      args.storageSize,
      args.sshKeyName,
      args.securityGroupId,
      args.name,
      args.region
    );
    return {
      data: {
        cmd: args.cmd,
        instanceId,
        name: args.name,
      },
    };
  }
}

//

export class Ec2InstanceState extends Command {
  async run(args: {
    server: Pick<TD_Server, 'ec2_instance_id'>[];
    region: string;
  }): Promise<TCommandReturn> {
    if (!args.server) throw new NotFoundException([]);

    const { region, server } = args;
    const { ec2_instance_id } = server[0];

    let state: TEc2InstanceState;

    if (ec2_instance_id === 'allocating') state = 'allocating';
    else {
      const m = new EC2InstanceManager();

      state = await m.getInstanceState(ec2_instance_id, region);
    }

    return {
      data: {
        state,
      },
    };
  }
}

//

export class Ec2InstanceStop extends Command {
  async run(args: {
    server: Pick<TD_Server, 'ec2_instance_id'>[];
    region: string;
  }): Promise<TCommandReturn> {
    if (!args.server) throw new NotFoundException([]);

    const { region, server } = args;
    const { ec2_instance_id } = server[0];

    const m = new EC2InstanceManager();

    await m.pause(ec2_instance_id, region);

    return {};
  }
}

//

export class Ec2InstanceStart extends Command {
  async run(args: {
    server: Pick<TD_Server, 'ec2_instance_id'>[];
    region: string;
  }): Promise<TCommandReturn> {
    if (!args.server) throw new NotFoundException([]);

    const { region, server } = args;
    const { ec2_instance_id } = server[0];

    const m = new EC2InstanceManager();

    await m.start(ec2_instance_id, region);

    return {};
  }
}

//

export class Ec2InstanceDelete extends Command {
  async run(args: {
    server: Pick<TD_Server, 'ec2_instance_id'>[];
    region: string;
  }): Promise<TCommandReturn> {
    if (!args.server) throw new NotFoundException([]);

    const { region, server } = args;
    const { ec2_instance_id } = server[0];

    const m = new EC2InstanceManager();

    await m.delete(ec2_instance_id, region);

    return {};
  }
}
