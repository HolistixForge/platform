# Infrastructure

Provisioning for the Holistix platform. Everything the platform needs —
Node.js, Docker Engine, PostgreSQL, Nginx, CoreDNS, TLS, the observability
stack and the gateway build server — is installed by a single Ansible
playbook.

The playbook targets **any Ubuntu 24.04 host reachable over SSH**:

| Target               | Inventory                       | TLS           | Source tree      |
| -------------------- | ------------------------------- | ------------- | ---------------- |
| Local development VM | `inventory/hosts.yml` (default) | mkcert        | shared from host |
| Staging / production | `inventory/production.yml`      | Let's Encrypt | git clone        |

This replaces the previous "run everything inside a dev container" setup. A
dev container has no systemd, no real Docker daemon, and no clean upgrade path
to a server — none of which is workable for production.

```
infra/
├── vm/
│   ├── vmctl.sh            # create and drive the local dev VM (Lima)
│   ├── lima-holistix.yaml  # VM definition: Ubuntu 24.04, virtiofs, vzNAT
│   └── cloud-init.yaml     # same base for Multipass / UTM / a cloud provider
└── ansible/
    ├── site.yml            # the playbook
    ├── inventory/          # hosts + group_vars (dev_vm, production)
    └── roles/              # common, node, docker, postgres, nginx,
                            # mkcert, certbot, coredns, workspace,
                            # buildserver, observability
```

## Local development VM — quick start

```bash
brew install lima ansible

cd infra/vm
./vmctl.sh bootstrap      # create the VM, then run Ansible against it
./vmctl.sh trust-ca       # trust the dev CA on your machine
./vmctl.sh dns test       # point the host resolver at the VM

./vmctl.sh shell
  cd /root/workspace/monorepo
  ./scripts/local-dev/create-env.sh dev-001 dev.test
  ./scripts/local-dev/build-frontend.sh dev-001
  ./scripts/local-dev/envctl.sh start dev-001

./vmctl.sh verify-ws dev-001   # prove the collab WebSocket relays events
```

Then browse to `https://dev.test`.

Full walkthrough, troubleshooting, and the migration notes from the dev
container: **[doc/guides/VM_DEVELOPMENT.md](../doc/guides/VM_DEVELOPMENT.md)**.

## Production server

```bash
cp infra/ansible/inventory/production.yml.example \
   infra/ansible/inventory/production.yml     # gitignored — fill it in

cd infra/ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventory/production.yml site.yml \
  -e vault_postgres_password="$(pass show holistix/pg)" \
  --check --diff        # dry run first
```

Production differs only through group variables: `holistix_tls_mode:
letsencrypt`, `holistix_repo_mode: clone`, CoreDNS off, and a real PostgreSQL
password. The roles themselves are identical, so what you test locally is what
you deploy.

## Re-running

The playbook is idempotent — re-run it after any change:

```bash
cd infra/ansible
ansible-playbook site.yml                    # everything
ansible-playbook site.yml --tags coredns     # just one role
ansible-playbook site.yml --check --diff     # show what would change
```

Tags: `common`, `node`, `docker`, `postgres`, `nginx`, `tls`, `mkcert`,
`certbot`, `coredns`, `workspace`, `buildserver`, `observability`.
