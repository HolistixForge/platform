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

import { TAirtableEvent } from '../../airtable-events';
import { TAirtableSharedData } from '../../airtable-shared-model';
import { TAirtableBaseSearchResult } from '../../airtable-types';

import './new-base.scss';

/**
 *
 */

export type NewAirtableBaseFormData = { baseId: string };

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
    useSharedData<TAirtableSharedData>(
      ['airtableBaseSearchResults'],
      (sd) => sd.airtableBaseSearchResults.get(currentUserId) || []
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
        if (!d.baseId) e.baseId = 'Please select a base';
      },
    }
  );

  // Search for bases on mount and when search query changes
  useEffect(() => {
    const searchBases = async () => {
      setIsSearching(true);
      try {
        await dispatcher.dispatch({
          type: 'airtable:search-bases',
          query: searchQuery,
          userId: currentUserId,
        });
      } catch (error) {
        console.error('Failed to search bases:', error);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchBases, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, dispatcher, currentUserId]);

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
      title="Select Airtable Base"
      description="Search and select an Airtable base to add to your project."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <div className="new-airtable-base-form">
        <div className="search-section">
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
              {searchQuery ? 'No bases found' : 'Start typing to search bases'}
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
      </div>
    </DialogControlled>
  );
};
