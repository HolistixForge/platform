import { ContainerImageRegistry } from './image-registry';
import {
  TContainerStackDefinition,
  TContainerStackService,
  stackExposedPorts,
} from './container-stack';

/**
 * A DNS label: what a name becomes once it is part of an FQDN.
 *
 * Both a service's name and an exposed door's name end up in one —
 * `{door}.uc-{cid}.org-{oid}.{domain}` for the door, and the service's own name
 * is its hostname on the stack's private network. Lowercase because DNS is
 * case-insensitive and the runtime lowercases anyway: allowing `Api` and `api`
 * would put two spellings of one name in the catalogue and one route at the
 * end of it.
 */
const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The two names `generateServiceFQDN` resolves to the base FQDN rather than to
 * a subdomain of it. They are one door under two spellings, so a stack using
 * both would declare two names and get one route.
 */
const BASE_DOOR_NAMES = ['main', 'default'];

const doorKey = (name: string): string =>
  BASE_DOOR_NAMES.includes(name) ? '(base)' : name;

/**
 * Catalogue of stacks a project may start.
 *
 * The same two tiers as `ContainerImageRegistry`, and for the same reasons —
 * built-ins registered in code and visible everywhere, project stacks visible
 * only to the project that registered them. It is a sibling of that registry
 * rather than part of it because a stack does not replace an image: it names
 * several, and every one of them is resolved through the image catalogue. That
 * is what carries the allowlist sideways instead of opening a second door into
 * it — a stack cannot name an image its project could not have started alone.
 *
 * Held against the image registry rather than given images at call time so the
 * two cannot be asked about different projects, which is the shape of a leak
 * rather than a mistake.
 */
export class ContainerStackRegistry {
  private readonly builtin: Map<string, TContainerStackDefinition> = new Map();

  private readonly byProject: Map<
    string,
    Map<string, TContainerStackDefinition>
  > = new Map();

  constructor(private readonly images: ContainerImageRegistry) {
    // Not left to the caller. Two catalogues keyed by project is two things to
    // clear, and the one that gets forgotten keeps serving the previous
    // tenant. Subscribing here means a stack registry cannot exist without
    // being cleared alongside the images it resolves against.
    images.onProjectCleared((projectId) => this.clearProject(projectId));
  }

  /**
   * Register built-in stacks, visible to every project.
   *
   * `projectId` is undefined here, so every image a built-in stack names must
   * itself be built-in. A built-in stack that reached into one project's images
   * would be a different stack per project under one id.
   */
  register(stacks: TContainerStackDefinition[]): void {
    stacks.forEach((stack) => {
      if (this.builtin.has(stack.stackId)) {
        throw new Error(`Stack ${stack.stackId} already registered`);
      }
      this.validate(stack, undefined);
      this.builtin.set(stack.stackId, stack);
    });
  }

  /**
   * Register stacks supplied by a project.
   *
   * The image-level rules are not restated here. Every service names an
   * `imageId` that has to resolve for this project, and a project image only
   * resolves if it already passed `registerForProject` — under
   * `ghcr.io/<githubOrganization>/`, digest-pinned, not shadowing a built-in.
   * Restating them would be a second copy to keep in step.
   */
  registerForProject(
    projectId: string,
    stacks: TContainerStackDefinition[]
  ): void {
    if (!projectId) {
      throw new Error('projectId is required to register stacks');
    }

    const scoped = this.byProject.get(projectId) ?? new Map();

    stacks.forEach((stack) => {
      if (this.builtin.has(stack.stackId)) {
        throw new Error(
          `Stack ${stack.stackId} is a built-in stack and cannot be overridden`
        );
      }
      if (scoped.has(stack.stackId)) {
        throw new Error(
          `Stack ${stack.stackId} already registered for project ${projectId}`
        );
      }
      this.validate(stack, projectId);
      scoped.set(stack.stackId, stack);
    });

    this.byProject.set(projectId, scoped);
  }

  /**
   * Everything a project registered, dropped.
   *
   * Reachable directly, but the path that matters is
   * `ContainerImageRegistry.clearProject`, which calls this through the
   * subscription in the constructor. One call clears both, so wiring
   * reallocation is one thing to remember rather than two.
   */
  clearProject(projectId: string): void {
    this.byProject.delete(projectId);
  }

  /** Resolve a stack id. Built-ins first, and without a project, only those. */
  get(
    stackId: string,
    projectId?: string
  ): TContainerStackDefinition | undefined {
    const builtin = this.builtin.get(stackId);
    if (builtin) return builtin;
    if (!projectId) return undefined;
    return this.byProject.get(projectId)?.get(stackId);
  }

  /** Whether this id names one of the platform's own stacks. */
  isBuiltin(stackId: string): boolean {
    return this.builtin.has(stackId);
  }

  /** Every stack a project may start. */
  getAll(projectId?: string): TContainerStackDefinition[] {
    const all = Array.from(this.builtin.values());
    if (!projectId) return all;
    const scoped = this.byProject.get(projectId);
    return scoped ? [...all, ...scoped.values()] : all;
  }

  /**
   * Everything that has to be true before a stack is a catalogue entry.
   *
   * All of it is checked here rather than at start: a stack that cannot work is
   * a thing somebody picked from a list, and the failure belongs where it was
   * written, not minutes later in a runner's log on a machine they do not
   * necessarily own.
   */
  private validate(
    stack: TContainerStackDefinition,
    projectId: string | undefined
  ): void {
    const where = `Stack ${stack.stackId}`;

    // Both are keys into one catalogue the user picks from. Two entries under
    // one id is an ambiguity nobody can see from the UI.
    if (this.images.get(stack.stackId, projectId)) {
      throw new Error(`${where} collides with an image of the same id`);
    }

    if (!stack.services.length) {
      throw new Error(`${where} has no services`);
    }

    const seenService = new Set<string>();
    stack.services.forEach((service) => {
      this.validateService(stack, service, projectId);
      if (seenService.has(service.serviceName)) {
        throw new Error(
          `${where} declares service ${service.serviceName} twice`
        );
      }
      seenService.add(service.serviceName);
    });

    // Across the stack, not per service. Every door hangs off the same
    // container id, so two services both exposing `api` describe one FQDN and
    // the gateway writes one block — the loser runs and answers nothing.
    const seenDoor = new Map<string, string>();
    stackExposedPorts(stack).forEach(({ serviceName, expose }) => {
      const key = doorKey(expose.name);
      const owner = seenDoor.get(key);
      if (owner) {
        throw new Error(
          `${where} exposes ${expose.name} on both ${owner} and ${serviceName}${
            key === '(base)'
              ? ` — ${BASE_DOOR_NAMES.join(' and ')} are the same name`
              : ''
          }`
        );
      }
      seenDoor.set(key, serviceName);
    });
  }

  private validateService(
    stack: TContainerStackDefinition,
    service: TContainerStackService,
    projectId: string | undefined
  ): void {
    const where = `Stack ${stack.stackId}, service ${service.serviceName}`;

    if (!DNS_LABEL.test(service.serviceName)) {
      throw new Error(`${where}: service name must be a lowercase DNS label`);
    }

    if (!this.images.get(service.imageId, projectId)) {
      throw new Error(
        `${where}: image ${service.imageId} is not in this project's catalogue`
      );
    }

    (service.exposes ?? []).forEach((expose) => {
      if (expose.name.startsWith('__')) {
        // `__guard_base` and `__guard_hub` are the gateway's own, and
        // `openableServices` hides anything with the prefix. A stack claiming
        // one would either be invisible or would take a route the auth guard
        // needs.
        throw new Error(
          `${where}: exposed name ${expose.name} uses the reserved __ prefix`
        );
      }
      if (
        !BASE_DOOR_NAMES.includes(expose.name) &&
        !DNS_LABEL.test(expose.name)
      ) {
        throw new Error(
          `${where}: exposed name ${expose.name} must be a lowercase DNS label`
        );
      }
      if (
        !Number.isInteger(expose.port) ||
        expose.port < 1 ||
        expose.port > 65535
      ) {
        throw new Error(
          `${where}: exposed port ${expose.port} is not a port number`
        );
      }
    });
  }
}
