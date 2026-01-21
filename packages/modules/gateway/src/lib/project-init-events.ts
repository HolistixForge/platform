/**
 * Project Initialization Events
 * 
 * Fired when a new project is created or first accessed
 * Triggers default data setup across all modules
 */

export type TEventProjectInit = {
  type: 'project:init';
  project_id: string;
  systemEvent: true;  // Automatically fired on project creation
};

export type TProjectEvents = TEventProjectInit;


