import {
  Command,
  TCommandReturn,
  generateJwtToken,
} from '@monorepo/backend-engine';
import { ForbiddenException, NotFoundException } from '@monorepo/log';
import {
  makeProjectScopeString,
  TJwtUserContainer,
} from '@monorepo/demiurge-types';
import {
  TServerImageOptions,
  TD_ServerImage,
  TG_Server,
} from '@monorepo/user-containers';
import { ONE_YEAR_MS, makeShortUuid } from '@monorepo/simple-types';

//

export class ServerCommand extends Command {
  async run(args: {
    user_id?: string;
    frontend_fqdn: string;
    ganymede_fqdn: string;
    account_fqdn: string;
    project_id: string;
    project_server_id: string;
    server: (Pick<TG_Server, 'server_name' | 'image_id' | 'host_user_id'> &
      Pick<
        TD_ServerImage,
        'image_name' | 'image_uri' | 'image_sha256' | 'image_tag'
      > & {
        image_options: TServerImageOptions;
        client_id: string;
        client_secret: string;
        service_name: string;
      })[];
  }): Promise<TCommandReturn> {
    if (!args.server) throw new NotFoundException([]);

    const { frontend_fqdn, ganymede_fqdn, account_fqdn, user_id } = args;
    const { server_name, image_uri, image_tag, host_user_id } = args.server[0];

    if (user_id && user_id !== host_user_id)
      throw new ForbiddenException([
        { message: 'You do not host this server' },
      ]);

    const payload: TJwtUserContainer = {
      type: 'server_token',
      project_id: args.project_id,
      project_server_id: args.project_server_id,
      scope: ['project:get-gateway', 'server:activity', 'project:vpn-access']
        .map((s) => makeProjectScopeString(args.project_id, s))
        .join(' '),
    };
    const token = generateJwtToken(
      payload,
      `${ONE_YEAR_MS}` // TODO: adjust expiration ?
    );

    const oauth_clients: { [k: string]: object } = {};
    args.server.forEach((oc) => {
      if (oc.service_name)
        oauth_clients[oc.service_name] = {
          client_id: oc.client_id,
          client_secret: oc.client_secret,
        };
    });

    const settings = {
      user_id,
      frontend_fqdn,
      ganymede_fqdn,
      account_fqdn,
      token,
      project_id: args.project_id,
      project_server_id: args.project_server_id,
      oauth_clients,
    };

    const json = JSON.stringify(settings);

    const env = Buffer.from(json).toString('base64');

    const fullname = `demiurge_${server_name}_${makeShortUuid()}`;

    return {
      data: `docker run --restart unless-stopped --name ${fullname} -e SETTINGS=${env} --cap-add=NET_ADMIN --device /dev/net/tun ${image_uri}:${image_tag}`,
    };
  }
}
