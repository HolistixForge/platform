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
import { makeUuid } from '@holistix/shared-types';

import { TAirtableEvent } from '../../airtable-events';
import { TAirtableSharedData } from '../../airtable-shared-model';
import { TAirtableBaseSearchResult } from '../../airtable-types';

import './new-base.scss';

/**
 *
 */

export type NewAirtableBaseFormData = { apiKey: string; baseId: string };

/**
 *
 */

export const NewAirtableBaseForm = ({
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

  const dispatcher = useDispatcher<TAirtableEvent>();
  const { awareness } = useAwareness();

  // Get current user ID
  const currentUser = awareness.getUser();
  const currentUserId = currentUser.user_id;

  // Get search results from shared data for current user
  const searchResults: TAirtableBaseSearchResult[] =
    useLocalSharedData<TAirtableSharedData>(
      ['airtable:base-search-results'],
      (sd) => sd['airtable:base-search-results'].get(currentUserId) || []
    );

  const action = useAction<NewAirtableBaseFormData>(
    async (d) => {
      await dispatcher.dispatch({
        type: 'airtable:init-base',
        baseId: d.baseId,
        origin: {
          viewId: viewId,
          position,
        },
        AIRTABLE_API_KEY: d.apiKey,
      });
      renderPanel({
        type: 'airtable-base',
        uuid: makeUuid(),
        data: {
          baseId: d.baseId,
        },
      });
    },
    [dispatcher, position, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.apiKey) e.apiKey = 'Please enter your Airtable API key';
        if (!d.baseId) e.baseId = 'Please select a base';
      },
    }
  );

  // Search for bases on mount and when search query changes
  useEffect(() => {
    const searchBases = async () => {
      if (action.formData.apiKey) {
        setIsSearching(true);
        try {
          await dispatcher.dispatch({
            type: 'airtable:search-bases',
            query: searchQuery,
            userId: currentUserId,
            AIRTABLE_API_KEY: action.formData.apiKey,
          });
        } catch (error) {
          console.error('Failed to search bases:', error);
        } finally {
          setIsSearching(false);
        }
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchBases, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, dispatcher, currentUserId, action.formData.apiKey]);

  //

  useEffect(() => {
    if (!action.isOpened) {
      closeForm();
      // Clear search results when form is closed
      dispatcher.dispatch({
        type: 'airtable:clear-user-search-results',
        userId: currentUserId,
      });
    }
  }, [action.isOpened, closeForm, dispatcher, currentUserId]);

  const handleBaseSelect = (base: TAirtableBaseSearchResult) => {
    action.handleChange({ baseId: base.id });
  };

  const getBaseTitle = (base: TAirtableBaseSearchResult) => {
    return base.name || 'Untitled Base';
  };

  const getBaseDescription = (base: TAirtableBaseSearchResult) => {
    return base.description || 'No description';
  };

  //

  return (
    <DialogControlled
      title={
        action.formData.apiKey
          ? 'Select Airtable Base'
          : 'Enter Airtable API Key'
      }
      description={
        action.formData.apiKey
          ? 'Search and select an Airtable base to add to your project.'
          : 'Paste your Airtable API key to continue. You can create one in your Airtable account settings.'
      }
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <div className="new-airtable-base-form">
        {!action.formData.apiKey ? (
          // API Key Input Step
          <>
            <div className="api-key-section">
              <TextFieldset
                label="Airtable API Key"
                name="apiKey"
                type="password"
                onChange={(e) =>
                  action.handleChange({ apiKey: e.target.value })
                }
                value={action.formData.apiKey || ''}
                placeholder="Enter your Airtable API key..."
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
          // Base Selection Step
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
                label="Search Bases"
                name="searchQuery"
                onChange={(e) => setSearchQuery(e.target.value)}
                value={searchQuery}
                placeholder="Search for bases..."
              />
            </div>

            <div className="search-results">
              {isSearching ? (
                <div className="loading-state">Searching bases...</div>
              ) : searchResults.length === 0 ? (
                <div className="empty-state">
                  {searchQuery
                    ? 'No bases found'
                    : 'Start typing to search bases'}
                </div>
              ) : (
                <div className="base-list">
                  {searchResults.map((base) => (
                    <div
                      key={base.id}
                      className={`base-item ${
                        action.formData.baseId === base.id ? 'selected' : ''
                      }`}
                      onClick={() => handleBaseSelect(base)}
                    >
                      <div className="base-title">{getBaseTitle(base)}</div>
                      <div className="base-description">
                        {getBaseDescription(base)}
                      </div>
                      <div className="base-id">ID: {base.id}</div>
                      <div className="base-permission">
                        Permission: {base.permissionLevel}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormError errors={action.errors} id="baseId" />
            <FormErrors errors={action.errors} />

            <div className="form-actions">
              <ButtonBase
                className="submit"
                callback={() => action.callback(action.formData)}
                text="Load Selected Base"
                loading={action.loading}
                disabled={!action.formData.baseId}
              />
            </div>
          </>
        )}
      </div>
    </DialogControlled>
  );
};
