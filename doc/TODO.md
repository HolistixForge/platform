⚠️ Antoine's stuffs

Ctrl F : MockColl...
Ctrl F : extracontext
Ctrl F : extraArgs

extraArgs => requestExports
extraContext => modulesExports

gatewayStopNotify

//

select username, s.user_id, created, last_access
from sessions s left join users u on (s.user_id = u.user_id)
where s.user_id = '91b1147b-845b-429e-bac3-2ac5b1a2c3ba' OR s.user_id = 'e4615ca5-636d-4f0d-b457-ff575a858f37'
order by last_access desc;

select username, s.user_id, created, last_access
from sessions s left join users u on (s.user_id = u.user_id)
order by last_access desc;

Daily backup

pointer:

- remove spring ?

collab-engine:

- granularite
- event sequence with fallback
- local or server reduction, (why if transaction works!)
- YJS handle send, send, send, send -> update -> apply old value problem ! optmistic UI work out of the box
- keep distant reduction for server events, and anything with intermediate api or process
- look for elegant react YJS hooks solution with fine granularity
- need for local override ?
- API
  use collaborators
  use Awareness
  use Data
- use Yjs type in story, with mock of other users
- PERMISSIONS management
- geographic permission
- permission and complexe non atomic process => decided to handle everything backend => latency, out of order => event sequences
- shift to normal use for majority of event ? => permission (content, spatial), fallback, ?

perf:

- indice: iframes blink on pan when edge menu open
- ONZOOM

ls -tp | tail -n +11 | sudo xargs -d '\n' rm --

edge editor:

- edge renderProps should be in graphviews, group style too

event sequence:

- fallback logics: add a reset point or function if not exists when sequenceRevertPoint is set

dns
shut down button

selected node zindex

- DNS: https://chatgpt.com/share/67acc6e5-32e4-8011-a71b-e4d900e0f9e5
- node positioning

- close tab for down resource
- click on card go to settings if down

- token update for resources

- iframe app wrapping, live status, stoped message, refresh gateway
- close reset retry websocket in frontend when project go down

- use env for { "sshKeyName": "dev-antoine-key", "securityGroupId": "sg-058d2af5f284c993c" }
- deploy cloud: storage = desired size + image size + image size uncompressed + os
- TODO_GATEWAY: delete connected server ?
- resource detail page
- share link ? user/resource association
- gateway disk image, auto resize gateway pool
- fine grained access control
- terminal, live users, granted users
- user finished free credits / payment
- API key : github gitlab, aws
- gpu access doc and docker options wizard
- /me trop bavard
- nginx error, home pages
- event permissions control
- delete hosted server: check down, only remove it from UI, explain it in user dialog,
- check server exist for /collab/vpn, /collab/event endpoint
- shared terminals
- new project from repo: data initialization from .py .ypmb .yaml
- TODO_EMAIL_VALIDATION
- TODO_JL_PROBE
- TODO_MENU
- db: prune old session, old magick link, old tokens and codes
- billing / cleaning cron (and also extraction of server run time from "project_servers" and "projects" before delete triggers, or aws have runtime data per instance ?)
- organization, group
- version monitoring/management: helm, terraform, eks cluster, npm dependencies, nodejs, react, react flow, jupyterlab/hub/widget
- db: not root for app. setup backup for prod db
- vscode server image
- open api: describe and validate cookies schemas
- template project sharing
- dispose terminals
- monaco function handle plugin
- collaborative bokeh widget
- requirejs version
- MyJvascriptRenderer... sandboxing / isolation. still needed for cloud labs ?
- useSharedData() re-render only if changes, performance audit
- monaco language chunks useless compilation
