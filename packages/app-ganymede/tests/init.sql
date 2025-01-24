
-- -----------------------------------------------------
-- Data for table `ganymede-db`.`projects`
-- -----------------------------------------------------
START TRANSACTION;
USE `ganymede-db`;
INSERT INTO `ganymede-db`.`projects` (`project_id`, `collab_url`, `owner_id`, `name`, `created`) VALUES (1, NULL, 'bob', 'bob project 1', DEFAULT);
INSERT INTO `ganymede-db`.`projects` (`project_id`, `collab_url`, `owner_id`, `name`, `created`) VALUES (2, NULL, 'alice', 'alice project 1', DEFAULT);
INSERT INTO `ganymede-db`.`projects` (`project_id`, `collab_url`, `owner_id`, `name`, `created`) VALUES (3, NULL, 'john', 'john project 1', DEFAULT);

COMMIT;


-- -----------------------------------------------------
-- Data for table `ganymede-db`.`projects_servers`
-- -----------------------------------------------------
START TRANSACTION;
USE `ganymede-db`;
INSERT INTO `ganymede-db`.`projects_servers` (`project_server_id`, `project_id`, `name`, `settings`) VALUES (1, 1, 'bob project 1 server 1', '{}');
INSERT INTO `ganymede-db`.`projects_servers` (`project_server_id`, `project_id`, `name`, `settings`) VALUES (2, 1, 'bob project 1 server 2', '{}');
INSERT INTO `ganymede-db`.`projects_servers` (`project_server_id`, `project_id`, `name`, `settings`) VALUES (3, 2, 'alice project 1 server 1', '{}');
INSERT INTO `ganymede-db`.`projects_servers` (`project_server_id`, `project_id`, `name`, `settings`) VALUES (4, 2, 'alice project 1 server 2', '{}');
INSERT INTO `ganymede-db`.`projects_servers` (`project_server_id`, `project_id`, `name`, `settings`) VALUES (5, 3, 'john project 1 server 1', '{}');
INSERT INTO `ganymede-db`.`projects_servers` (`project_server_id`, `project_id`, `name`, `settings`) VALUES (6, 3, 'john project 1 server 2', '{}');

COMMIT;


-- -----------------------------------------------------
-- Data for table `ganymede-db`.`projects_servers_authorizations`
-- -----------------------------------------------------
START TRANSACTION;
USE `ganymede-db`;
INSERT INTO `ganymede-db`.`projects_servers_authorizations` (`user_id`, `project_server_id`, `scopes`, `since`) VALUES ('bob', 3, 'read,execute', DEFAULT);
INSERT INTO `ganymede-db`.`projects_servers_authorizations` (`user_id`, `project_server_id`, `scopes`, `since`) VALUES ('bob', 4, 'start,stop', DEFAULT);
INSERT INTO `ganymede-db`.`projects_servers_authorizations` (`user_id`, `project_server_id`, `scopes`, `since`) VALUES ('bob', 5, 'start', DEFAULT);

COMMIT;

INSERT INTO sessions (session_id, session) VALUES ("eb00899a-cef0-11ed-82ed-0242ac110002", "{}");
