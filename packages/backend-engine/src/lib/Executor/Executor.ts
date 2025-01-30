import { DeepReadonly } from 'ts-essentials';
import { Request } from '../Request/Request';
import { ApiDefinition, TApiPoint } from '../ApiDefinition/ApiDefinition';
import { EpDefinition, TPipeline, TStep } from '../EpDefinition/EpDefinition';
import { NotFoundException } from '../Exceptions/Exception';
import { CommandFactory } from '../Command/CommandFactory';
import { Connections } from '../databases/sql/Connections';
import { Inputs } from '../InputSource/Inputs';
import { EColor, log } from '@monorepo/log';
import { evalConditions, TElse } from './conditions';
import { TCookie } from '../Response/Response';
import { TUri } from '@monorepo/simple-types';
import { Sql } from '../databases/sql/Sql';

const DGP = '##########';

//
//
//

export class Executor {
  _apiDefinition: DeepReadonly<ApiDefinition>;
  _inputs: Inputs;
  _epDefinition: DeepReadonly<EpDefinition>;
  _connections: DeepReadonly<Connections> = {
    _sqlConnections: {},
    get: function (cid: string): DeepReadonly<Sql> | undefined {
      throw new Error('No connections set');
    },
  };

  //
  //

  constructor(
    apiDefinition: DeepReadonly<ApiDefinition>,
    epDefinition: DeepReadonly<EpDefinition>,
    inputs: Inputs
  ) {
    this._inputs = inputs;

    this._apiDefinition = apiDefinition;

    this._epDefinition = epDefinition;
  }

  //
  //

  setConnections(connections: Connections) {
    this._connections = connections;
  }

  //
  //

  async _findEndpoint(request: Request): Promise<TApiPoint> {
    const method = this._apiDefinition.routeRequest(request);
    const endpoints = method['x-backend-engine'];
    let endpoint = null;
    for (let i = 0; i < endpoints.points.length; i++) {
      const ep = endpoints.points[i];
      if (ep.selector === false) continue;
      const v =
        ep.selector === true
          ? true
          : await this._inputs.evalInput(ep.selector, request);
      if (v) {
        endpoint = ep;
        break;
      }
    }

    if (endpoint === null)
      throw new NotFoundException([
        { message: `No Matching ep [${request.path}]:[${request.httpMethod}]` },
      ]);

    return endpoint;
  }

  //
  //

  async _doStep(request: Request, step: Readonly<TStep>) {
    //

    const args = await this._inputs.cloneEvalArgs(step.args, request);

    log(7, 'PIPELINE', 'args', args);

    const command = CommandFactory.get(step.type, {
      connections: this._connections,
      inputs: this._inputs,
      request: request,
    });

    const stepResult = await command.run(args as object);

    log(7, 'PIPELINE', 'returned', stepResult);

    if (step.graft && stepResult.data)
      request.response.set(step.graft, stepResult.data);

    if (stepResult.serverSentEvents)
      request.response.addServerSentEvents(stepResult.serverSentEvents);

    if (stepResult.headers) request.response.addHeaders(stepResult.headers);

    // cookies returned by step Command
    if (stepResult.cookies) request.response.addCookies(stepResult.cookies);

    // cookies defined in step definition
    if (step.cookies) {
      const cookies = await this._inputs.cloneEvalArgs(step.cookies, request);
      request.response.addCookies(cookies as TCookie[]);
    }

    return stepResult;
  }

  //
  //

  async doRequest(request: Request) {
    const point = await this._findEndpoint(request);

    // doRequest() will be called periodically
    if (point.eventSource) request.isEventSource = true;

    const pipeline: TPipeline = this._epDefinition.getPipeline(
      point['exec-pipe-id']
    );

    for (const [i, step] of pipeline.steps.entries()) {
      const info = `[${i}${step.description ? `: ${step.description}` : ''}]`;

      if (step.disabled) {
        log(7, '', `${DGP} step ${info} disabled`, null, EColor.FgRed);
        continue;
      }

      if (step.if) {
        const isActive = await evalConditions(step.if, this._inputs, request);
        if (!isActive) {
          log(7, '', `${DGP} step ${info} inactive`, null, EColor.FgRed);
          if (step.if.else) {
            const e = step.if.else as TElse;
            if (e.break) {
              request.response.setStatusCode(e.break.statusCode);
              request.response.set('.', {
                errors: [{ message: e.break.message }],
              });
              break;
            }
          }
          continue;
        }
      }

      log(7, '', `${DGP} step ${info} active`, null, EColor.FgGreen);
      const stepResult = await this._doStep(request, step);

      if (stepResult.redirect) {
        request.response.redirect(stepResult.redirect);
        break;
      }

      if (step.if?.break) break;
    }

    if (request.response._redirection) {
      request.response._redirection = (await this._inputs.cloneEvalArgs(
        request.response._redirection,
        request
      )) as TUri;
    }
  }
}
