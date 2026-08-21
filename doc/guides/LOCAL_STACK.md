# Brancher une stack locale sur la plateforme

Comment plusieurs conteneurs qui tournent sur votre machine deviennent **un service du
projet**, avec un seul d'entre eux joignable depuis la plateforme.

Suit [TAC-365](https://linear.app/tachikoma/issue/TAC-365).

> **État — lisez ceci avant de suivre le guide.**
>
> Le parcours décrit ici n'est **pas** exécutable de bout en bout aujourd'hui.
>
> |                                                                  |                                                                   |
> | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
> | Le manifeste : format, lecture, validation                       | ✅ écrit, 51 tests                                                |
> | Le catalogue de stacks                                           | ✅ écrit                                                          |
> | Le runner : enrôlement, boucle, réconciliation                   | ✅ existe ([TAC-156](https://linear.app/tachikoma/issue/TAC-156)) |
> | Le runner sait démarrer **une** image                            | ✅                                                                |
> | **Placer un service sur une machine enrôlée depuis l'interface** | ❌ [TAC-177](https://linear.app/tachikoma/issue/TAC-177)          |
> | Une stack peut être choisie et placée                            | ❌ [TAC-367](https://linear.app/tachikoma/issue/TAC-367)          |
> | Le runner sait démarrer **une stack**                            | ❌ [TAC-368](https://linear.app/tachikoma/issue/TAC-368)          |
> | Le sidecar qui porte le tunnel pour une image tierce             | ❌ [TAC-369](https://linear.app/tachikoma/issue/TAC-369)          |
> | Le script copy-paste qui installe tout ça                        | ❌ [TAC-370](https://linear.app/tachikoma/issue/TAC-370)          |
>
> Ce document est donc à la fois un guide et une spécification : ce qui est
> marqué ❌ décrit ce qui **doit** se passer, pas ce qui se passe. Les sections
> concernées le disent.
>
> **La ligne en gras est le blocage qui précède tout le reste** : le bouton
> Local n'émet pas de `machine_id`, donc aucun placement local n'atteint aucun
> runner aujourd'hui — ni une stack, ni même une image seule. Le plan complet,
> jusqu'au test bout en bout, est sur
> [TAC-365](https://linear.app/tachikoma/issue/TAC-365).

---

## Le problème

Un service local, aujourd'hui, c'est une image. Mais une application réelle est
une pile : une interface, une API, une base, peut-être un worker. Vous voulez
que **l'interface** soit ouvrable depuis le tableau du projet — et vous ne
voulez surtout pas que la base le soit.

D'où la règle qui structure tout le reste :

> Un port qui n'est pas déclaré n'a pas de nom, et personne ne peut l'atteindre.

Le défaut est **non exposé**. L'inverse — tout publier, à charge pour vous de
retirer — ferait d'une ligne oubliée la différence entre une base privée et une
base ouverte sur le projet.

---

## Le manifeste

Un fichier à la racine du dépôt, `holistix.stack.yaml` :

```yaml
version: 1
stack: acme-platform
name: Acme Platform

services:
  api:
    image: acme:api
    ports: [8080, 9090]
    tunnel:
      - port: 8080
        name: main
      - port: 9090
        name: metrics
    sync:
      - from: ./api
        to: /app

  db:
    image: acme:db
    ports: [5432]
```

Il vit **dans votre dépôt**, pas dans un catalogue enregistré par API : ce qui
tourne et ce qui est joignable bougent alors avec le code qui les a changés, et
passent dans la même revue.

### `ports` et `tunnel` sont deux questions différentes

C'est le cœur du format, et la seule chose à retenir si vous ne retenez qu'une
chose.

| Champ    | Répond à                               | Effet                        |
| -------- | -------------------------------------- | ---------------------------- |
| `ports`  | sur quoi ce service écoute             | le runner le lie             |
| `tunnel` | lesquels de ces ports reçoivent un nom | un bloc nginx sur le gateway |

Dans l'exemple, `db` déclare `5432` et ne le tunnelle pas : `api` l'atteint par
le nom `db` sur le réseau privé de la stack, et rien en dehors ne peut y aller.

Une seule liste aurait fait de « tourne » et « est public » le même mot.

### Les champs, un par un

| Champ                             | Obligatoire | Notes                                                   |
| --------------------------------- | ----------- | ------------------------------------------------------- |
| `version`                         | oui         | `1`. Une autre valeur est refusée, pas devinée.         |
| `stack`                           | oui         | L'identifiant. Ne doit pas être déjà un `image_id`.     |
| `name`                            | non         | Affiché. À défaut, `stack`.                             |
| `description`, `category`, `icon` | non         | Comme pour une image.                                   |
| `services`                        | oui         | Une entrée par conteneur, la clé est le nom du service. |

Par service :

| Champ    | Obligatoire | Notes                                                          |
| -------- | ----------- | -------------------------------------------------------------- |
| `image`  | oui         | Un **id de catalogue**, pas une URI. Voir plus bas.            |
| `ports`  | non         | Les ports que le service ouvre.                                |
| `tunnel` | non         | Absent ou vide → le service n'est joignable que dans la stack. |
| `sync`   | non         | Répertoires tenus à jour depuis l'arbre de travail.            |

Par entrée de `tunnel` :

| Champ    | Obligatoire | Notes                                     |
| -------- | ----------- | ----------------------------------------- |
| `port`   | oui         | Doit figurer dans les `ports` du service. |
| `name`   | non         | Par défaut, le nom du service.            |
| `secure` | non         | Le service parle-t-il TLS.                |

### `image` est un id, pas une URI

Vous écrivez `acme:api`, pas `ghcr.io/acme/api:1.4.0@sha256:…`.

L'id est une clé d'allowlist. Le broker « never accepts a command line, and
never accepts a bare image URI from the gateway » : il résout l'id contre le
catalogue du projet et compose le run lui-même. Une stack ne peut donc pas
nommer une image que votre projet n'aurait pas pu démarrer seul — et les règles
qui s'appliquent à une image (vivre sous `ghcr.io/<votre-org-github>/`, être
épinglée par digest) portent sans être réécrites ici.

### Pourquoi ce n'est pas un `docker-compose.yml`

Un compose est une ligne de commande déguisée : il porte `privileged`,
`volumes`, `network_mode`, `cap_add`, `devices`. En accepter un rendrait tout ce
que l'id d'image protège.

Le manifeste **déclare** ce qui tourne et ce qui est joignable ; le runner
compose l'invocation, exactement comme le broker le fait déjà pour un conteneur
seul.

C'est aussi pourquoi le fichier ne s'appelle pas `*.ansible.yaml` : ce n'est pas
de l'Ansible, et il y a du vrai Ansible dans `infra/ansible`.

---

## Ce que ça donne comme adresses

Une stack est **un** `user_container` pour la plateforme. Chaque porte tunnelée
reçoit un nom sous lui :

```
{name}.uc-{container_id}.org-{organization_id}.{domain}
```

Avec le manifeste ci-dessus, sur `apollo.test:8443` :

| Déclaré           | Adresse                                      |
| ----------------- | -------------------------------------------- |
| `name: main`      | `uc-{id}.org-{org}.apollo.test:8443`         |
| `name: metrics`   | `metrics.uc-{id}.org-{org}.apollo.test:8443` |
| `db`, non tunnelé | _aucune_                                     |

`main` et `default` désignent le nom de base. Tout autre nom devient un
sous-domaine.

Rien de tout cela n'est nouveau : un conteneur publie déjà un
`map-http-service` par porte et le gateway écrit déjà un bloc nginx par entrée
(`update-nginx-locations.sh`). Une stack se pose dessus sans toucher au gateway,
à nginx, ni au schéma de nommage.

---

## Le rsync live

Le but d'une stack sur votre machine, c'est que vous l'éditez. `sync` demande au
runner de tenir un répertoire du conteneur à jour depuis l'arbre de travail —
et non d'en figer une copie au démarrage.

```yaml
sync:
  - from: ./api # dans le dépôt, relatif au manifeste
    to: /app # dans le conteneur, absolu
```

`from` doit rester **dans** le dépôt. Un chemin absolu ou remontant par `..` est
refusé : le manifeste vient d'un dépôt et sera lu par un script que quelqu'un
colle dans un terminal, donc `from: ../../../.ssh` rsyncerait ses clés dans un
conteneur.

> ❌ Le runner ne fait pas encore ce rsync. Le champ est lu et validé.

---

## Mettre en route

### 1. Enrôler la machine — ✅ marche

Une fois par machine :

```bash
holistix-runner login -u https://apollo.test:8443 --label "mac-m1"
```

Le navigateur s'ouvre pour la partie humaine (flux PKCE, redirection loopback).
Sur une machine sans écran, l'URL est affichée et `HOLISTIX_NO_BROWSER=1`
supprime la tentative d'ouverture.

Ce qui reste sur disque, dans `~/.holistix/runner.json` en `0600`, **n'est pas**
votre jeton utilisateur : celui-là est dépensé une fois pour enrôler puis jeté.
Ce qui est gardé nomme la machine.

```bash
holistix-runner status      # toujours enrôlée ?
holistix-runner disconnect  # se retirer et supprimer le jeton
```

### 2. Choisir le moteur

```bash
export RUNNER_ENGINE=apple    # ou docker
```

Nommé par l'environnement, jamais deviné d'après ce qui est installé. Sur un
Mac, `apple` donne un noyau invité par conteneur : ça vous protège des services
que **d'autres membres du projet** peuvent placer sur votre machine.

Trois contrôles n'existent pas sur ce moteur et sont rapportés au démarrage :
`restart-policy`, `no-hot-network-attach`, `no-add-host`.

> ⚠️ `no-hot-network-attach` touche directement une stack : deux services déjà
> en marche ne peuvent pas être câblés ensemble sans redémarrage. Le runner
> recrée au lieu de rattacher.

### 3. Lancer la boucle — ✅ marche

```bash
holistix-runner run                 # toutes les 15 s
holistix-runner run --once          # une passe, pour regarder
holistix-runner run -i 30           # toutes les 30 s
```

Une passe : demander à Ganymede dans quels projets cette machine est, s'annoncer
au gateway de chacun, lui demander ce qu'il y a placé, et réconcilier le moteur
contre la réponse. Un conteneur conforme est laissé strictement tranquille.

### 4. Placer la stack sur votre machine — ❌ pas écrit

C'est ici que le parcours s'arrête aujourd'hui. Il manque :

1. **Le script copy-paste** : cloner le dépôt, lire le manifeste, lancer
   l'enrôlement s'il le faut.
2. **`compose up` dans le runner** : `engine-docker.ts` et `engine-apple.ts` ne
   savent démarrer qu'une image à la fois.
3. **Le sidecar VPN** : voir ci-dessous.

---

## Le sidecar, et pourquoi il faut en passer par là — ❌ pas écrit

Aujourd'hui, `httpServices` est publié **de l'intérieur** du conteneur, par un
agent Holistix embarqué dans l'image. Les images du catalogue
(`holistixforge/jupyterlab-minimal`, `n8n`, `ttyd-tools`) le font. L'image
Postgres officielle, non.

Une stack doit donc exposer des images qu'on ne contrôle pas. La forme retenue :
un conteneur Holistix en `network_mode: service:<interface>`, qui

- porte le **seul** client VPN de la stack — pas un par service ;
- publie les `httpServices` **à la place** de l'image, sans la modifier ;
- déclare une entrée par porte tunnelée du manifeste.

Le gateway écrivant déjà un bloc nginx par entrée, exposer deux ou trois
services d'une même stack ne coûte rien de plus côté plateforme.

---

## Ce que le format refuse, et pourquoi

Chaque refus correspond à une panne qu'on aurait diagnostiquée ailleurs.

| Écrit                                   | Refusé parce que                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| un `tunnel.port` absent de `ports`      | on aurait un nom, un bloc nginx, et `connection refused` — ce qui se lit comme un tunnel cassé    |
| deux services exposant le même `name`   | même FQDN : un seul bloc gagne, le perdant tourne et ne répond à rien                             |
| `main` sur l'un, `default` sur l'autre  | les deux désignent le nom de base, donc c'est le cas précédent                                    |
| un point dans un `name`                 | le FQDN est construit par interpolation et rien ne nettoie : ça ajoute un label                   |
| un `name` commençant par `__`           | réservé au garde d'authentification (`__guard_base`, `__guard_hub`), et masqué de l'interface     |
| `sync.from` absolu ou avec `..`         | sort du dépôt                                                                                     |
| une `image` hors du catalogue du projet | c'est l'allowlist                                                                                 |
| un `version` autre que `1`              | un manifeste plus récent peut vouloir dire autre chose par un champ que celui-ci croit comprendre |

---

## Local puis cloud

Le mécanisme ne change pas. Le conteneur compose **vers** le gateway, ce qui est
déjà le sens qui traverse un NAT ; et le tunnel est déjà dynamique et par
organisation — OpenVPN démarre dans le gateway à l'allocation, avec des
certificats frappés à ce moment, et s'arrête quand le gateway redevient idle.

Ce qui tombe en passant au cloud est ce qui n'existe que pour le local :

| Local                                                                                                                                                                            | Cloud                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `dev_host_ip` → `--add-host` pour `gateway.apollo.test` et `ganymede.apollo.test`, parce que `.test` ne résout pas dans un conteneur                                             | DNS public, à supprimer                                                                                                        |
| `gateway_dev: true` → `--insecure-skip-verify` sur le garde, parce que mkcert n'est pas une CA connue du conteneur                                                               | certificat public. C'est un drapeau de sécurité : il doit être **impossible** à activer en production, pas seulement désactivé |
| VPN en TCP, quand le moteur ne porte pas l'UDP (sous Apple `container`, le port UDP publié se lie après `container start` : un client finit son handshake et la connexion meurt) | UDP                                                                                                                            |
| `VPN_BASE=49100`, un port par gateway                                                                                                                                            | à ouvrir                                                                                                                       |

---

## Voir aussi

- [`CLOUD_RUNNER.md`](../architecture/CLOUD_RUNNER.md) — les deux moteurs, les
  concessions, pourquoi un microVM
- [`GATEWAY_ARCHITECTURE.md`](../architecture/GATEWAY_ARCHITECTURE.md) — nginx en
  deux étages, cycle de vie du VPN
- [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) — monter la plateforme elle-même
