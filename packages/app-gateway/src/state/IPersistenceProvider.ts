/**
 * Persistence Provider Interface
 *
 * Implemented by Managers and ProjectRooms to provide persistence capabilities.
 * GatewayState uses this interface to collect and restore data.
 */

export interface IPersistenceProvider {
  /**
   * Load data from serialized snapshot
   * @param data - Serialized data (JSON object) for this provider's data slice
   */
  loadFromSerialized(data: Record<string, unknown> | null | undefined): void;

  /**
   * Save data to serializable format
   * @returns Serializable JSON object representing this provider's data slice
   */
  saveToSerializable(): Record<string, unknown>;
}

