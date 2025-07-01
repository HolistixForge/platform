import { useEffect, useState } from 'react';

import {
  ButtonBase,
  FormError,
  FormErrors,
  TextFieldset,
  useAction,
  DialogControlled,
} from '@monorepo/ui-base';
import {
  useDispatcher,
  useSharedData,
  useAwareness,
} from '@monorepo/collab-engine';
import { TPosition } from '@monorepo/core';
import { TPanel } from '@monorepo/module/frontend';
import { makeUuid } from '@monorepo/simple-types';

import { TNotionEvent } from '../../notion-events';
import { TNotionSharedData } from '../../notion-shared-model';
import { TNotionDatabaseSearchResult } from '../../notion-types';

import './new-database.scss';

/**
 *
 */

export type NewNotionDatabaseFormData = { databaseId: string };

/**
 *
 */

export const NewNotionDatabaseForm = ({
  viewId,
  position,
  closeForm,
  renderPanel,
}: {
  viewId: string;
  position: TPosition;
  closeForm: () => void;
  renderPanel: (panel: TPanel) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const dispatcher = useDispatcher<TNotionEvent>();
  const { awareness } = useAwareness();

  // Get current user ID
  const currentUser = awareness.getUser();
  const currentUserId = currentUser.user_id;

  // Get search results from shared data for current user
  const searchResults: TNotionDatabaseSearchResult[] =
    useSharedData<TNotionSharedData>(
      ['notionDatabaseSearchResults'],
      (sd) => sd.notionDatabaseSearchResults.get(currentUserId) || []
    );

  const action = useAction<NewNotionDatabaseFormData>(
    async (d) => {
      await dispatcher.dispatch({
        type: 'notion:init-database',
        databaseId: d.databaseId,
        origin: {
          viewId: viewId,
          position,
        },
      });
      renderPanel({
        type: 'notion-database',
        uuid: makeUuid(),
        data: {
          databaseId: d.databaseId,
        },
      });
    },
    [dispatcher, position, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.databaseId) e.databaseId = 'Please select a database';
      },
    }
  );

  // Search for databases on mount and when search query changes
  useEffect(() => {
    const searchDatabases = async () => {
      setIsSearching(true);
      try {
        await dispatcher.dispatch({
          type: 'notion:search-databases',
          query: searchQuery,
          userId: currentUserId,
        });
      } catch (error) {
        console.error('Failed to search databases:', error);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchDatabases, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, dispatcher, currentUserId]);

  //

  useEffect(() => {
    if (!action.isOpened) {
      closeForm();
      // Clear search results when form is closed
      dispatcher.dispatch({
        type: 'notion:clear-user-search-results',
        userId: currentUserId,
      });
    }
  }, [action.isOpened, closeForm, dispatcher, currentUserId]);

  const handleDatabaseSelect = (database: TNotionDatabaseSearchResult) => {
    action.handleChange({ databaseId: database.id });
  };

  const getDatabaseTitle = (database: TNotionDatabaseSearchResult) => {
    return database.title?.[0]?.text?.content || 'Untitled Database';
  };

  const getDatabaseDescription = (database: TNotionDatabaseSearchResult) => {
    return database.description?.[0]?.text?.content || 'No description';
  };

  //

  return (
    <DialogControlled
      title="Select Notion Database"
      description="Search and select a Notion database to add to your project."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <div className="new-notion-database-form">
        <div className="search-section">
          <TextFieldset
            label="Search Databases"
            name="searchQuery"
            onChange={(e) => setSearchQuery(e.target.value)}
            value={searchQuery}
            placeholder="Search for databases..."
          />
        </div>

        <div className="search-results">
          {isSearching ? (
            <div className="loading-state">Searching databases...</div>
          ) : searchResults.length === 0 ? (
            <div className="empty-state">
              {searchQuery
                ? 'No databases found'
                : 'Start typing to search databases'}
            </div>
          ) : (
            <div className="database-list">
              {searchResults.map((database) => (
                <div
                  key={database.id}
                  className={`database-item ${
                    action.formData.databaseId === database.id ? 'selected' : ''
                  }`}
                  onClick={() => handleDatabaseSelect(database)}
                >
                  <div className="database-title">
                    {getDatabaseTitle(database)}
                  </div>
                  <div className="database-description">
                    {getDatabaseDescription(database)}
                  </div>
                  <div className="database-id">ID: {database.id}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <FormError errors={action.errors} id="databaseId" />
        <FormErrors errors={action.errors} />

        <div className="form-actions">
          <ButtonBase
            className="submit"
            callback={() => action.callback(action.formData)}
            text="Load Selected Database"
            loading={action.loading}
            disabled={!action.formData.databaseId}
          />
        </div>
      </div>
    </DialogControlled>
  );
};
