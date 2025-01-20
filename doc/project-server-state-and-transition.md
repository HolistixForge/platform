# project server state and transition

## Data model 

[project server types](../packages/demiurge-types/src/lib/project-server.ts)

## CASES

```

server has no **host_user_id** and no **ec2_instance_id**:
    => **location** = none
    => show "HOST" and "CLOUD" button to all users

//

user click "HOST" button:
    => call PROJECT_GATEWAY_API
        => call GANYMEDE_API:
            => check user has server:host scope
            => DATABASE proc_projects_servers_set_location()
                => check **host_user_id** and **ec2_instance_id** are not set yet
                => set **host_user_id**
        => call GANYMEDE_API: project_server state
        => **host_user_id** shared state prop updated
    => host has now the "COPY DOCKER CMD" button
    => other users have no control button

//

user click "COPY DOCKER CMD" button:
    => user choose [cpu, ram, storage, gpu, etc.] limits options
    => call GANYMEDE_API:
        => check user is host_user_id and user still has server:host scope,
        => generate docker command
            => generate server tokens, settings, etc.
    => docker command copied

user run command:
    => container start
        => call GANYMEDE_API get gateway endpoint
        => connect GATEWAY VPN
        => call PROJECT_GATEWAY_API *watchdog* and *services publish* endpoints
            => **last_watchdog_at**, **ip**, **services** shared state prop updated

//

user click "CLOUD" button:
    => user choose [cpu, ram, storage, gpu, etc.] by selecting an instance type (aws ec2 types) options 
    // ami-002c743bda62bd54a, ami-05763d63bd86bcd34, g4dn ?
    => call PROJECT_GATEWAY_API:
        => call GANYMEDE_API:
            => check user has server:cloud scope
            => DATABASE proc_projects_servers_set_location()
                => check **host_user_id** and **ec2_instance_id** are not set yet
                => set **ec2_instance_id** = 'allocating'
            => generate docker command
                => generate server tokens, settings, etc.
            => start new instance via AWS_API
            => DATABASE
                => set **ec2_instance_id**
        => GANYMEDE_API: poll project_server state for 5 minutes / 10 secondes
            => poll instance state via AWS_API
            => **ec2_instance_state** shared state prop updated

ec2 instance start, docker install, docker command run
    => container start
        => call GANYMEDE_API get gateway endpoint
        => connect GATEWAY VPN
        => call PROJECT_GATEWAY_API *watchdog* and *services publish* endpoints
            => **last_watchdog_at**, **ip**, **services** shared state prop updated

//

UI: switch shared state: **ec2_instance_state**:
    'starting': message "starting..."
    'started': button PAUSE
    'stopping': message "stopping..."
    'stopped': button PLAY

//

user click "PAUSE" button (for cloud server only):
    => call PROJECT_GATEWAY_API:
        => call GANYMEDE_API:
            => check user has server:stop scope
            => stop instance via AWS_API (fail if not running, that's fine)
        => GANYMEDE_API: poll project_server state for 5 minutes / 10 secondes
            => poll instance state via AWS_API
            => **ec2_instance_state** shared state prop updated
    => disable "PAUSE" button for 20 secondes

//

user click "PLAY" button (for cloud server only):
    => call PROJECT_GATEWAY_API:
        => call GANYMEDE_API:
            => check user has server:start scope
            => start instance via AWS_API (fail if not stopped, that's fine)
        => GANYMEDE_API: poll project_server state for 5 minutes / 10 secondes
            => poll instance state via AWS_API
            => **ec2_instance_state** shared state prop updated
    => disable "PAUSE" button for 20 secondes

//
//
//

rationals:
- host must be able to copy command multiple time in case they lost it
- users must not be able to start the same server in a race condition case
```
