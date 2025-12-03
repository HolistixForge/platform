import { useEffect, useState } from 'react';

import {
  ButtonBase,
  FormError,
  FormErrors,
  TextFieldset,
  useAction,
  DialogControlled,
} from '@holistix/ui-base';
import { useAwareness, useLocalSharedData } from '@holistix/collab/frontend';
import { useDispatcher } from '@holistix/reducers/frontend';
import { TPosition } from '@holistix/core-graph';
import { TPanel } from '@holistix/space/frontend';
import { makeUuid } from '@holistix/simple-types';

import { TNotionEvent } from '../../notion-events';
import { TNotionSharedData } from '../../notion-shared-model';
import { TNotionDatabaseSearchResult } from '../../notion-types';

import './new-database.scss';

/**
 *
 */

export type NewNotionDatabaseFormData = { apiKey: string; databaseId: string };

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
    useLocalSharedData<TNotionSharedData>(
      ['notion:database-search-results'],
      (sd) => sd['notion:database-search-results'].get(currentUserId) || []
    );

  const action = useAction<NewNotionDatabaseFormData>(
    async (d) => {
      await dispatcher.dispatch({
        type: 'notion:init-database',
        NOTION_API_KEY: d.apiKey,
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
        if (!d.apiKey) e.apiKey = 'Please enter your Notion API key';
        if (!d.databaseId) e.databaseId = 'Please select a database';
      },
    }
  );

  // Search for databases on mount and when search query changes
  useEffect(() => {
    const searchDatabases = async () => {
      if (action.formData.apiKey) {
        setIsSearching(true);
        try {
          await dispatcher.dispatch({
            type: 'notion:search-databases',
            NOTION_API_KEY: action.formData.apiKey,
            query: searchQuery,
            userId: currentUserId,
          });
        } catch (error) {
          console.error('Failed to search databases:', error);
        } finally {
          setIsSearching(false);
        }
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchDatabases, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, dispatcher, currentUserId, action.formData.apiKey]);

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
      title={
        action.formData.apiKey
          ? 'Select Notion Database'
          : 'Enter Notion API Key'
      }
      description={
        action.formData.apiKey
          ? 'Search and select a Notion database to add to your project.'
          : 'Paste your Notion API key to continue. You can create one in your Notion account settings.'
      }
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <div className="new-notion-database-form">
        {!action.formData.apiKey ? (
          // API Key Input Step
          <>
            <div className="api-key-section">
              <TextFieldset
                label="Notion API Key"
                name="apiKey"
                type="password"
                onChange={(e) =>
                  action.handleChange({ apiKey: e.target.value })
                }
                value={action.formData.apiKey || ''}
                placeholder="Enter your Notion API key..."
              />
            </div>

            <FormError errors={action.errors} id="apiKey" />
            <FormErrors errors={action.errors} />

            <div className="form-actions">
              <ButtonBase
                className="submit"
                text="Continue"
                loading={action.loading}
                disabled={true}
              />
            </div>
          </>
        ) : (
          // Database Selection Step
          <>
            <div className="search-section">
              <div className="api-key-info">
                <span>API Key configured</span>
                <ButtonBase
                  className="back-button"
                  callback={() => action.handleChange({ apiKey: '' })}
                  text="Change API Key"
                />
              </div>
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
                        action.formData.databaseId === database.id
                          ? 'selected'
                          : ''
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
          </>
        )}
      </div>
    </DialogControlled>
  );
};
