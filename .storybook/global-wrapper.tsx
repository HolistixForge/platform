import React, { FC } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { BrowserRouter } from 'react-router-dom';

/**
 * Shared decorator for every story in the workspace.
 *
 * Identical to the per-package `global-wrapper.tsx` files, which had drifted
 * apart only cosmetically (typed `FC` versus `any`, expression versus block
 * body) while doing exactly the same thing.
 */
export const GlobalWrapper = (Story: FC) => (
  <BrowserRouter>
    <Tooltip.Provider>
      <Story />
    </Tooltip.Provider>
  </BrowserRouter>
);
