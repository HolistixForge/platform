import * as Tooltip from '@radix-ui/react-tooltip';
import { BrowserRouter } from 'react-router-dom';

export const GlobalWrapper = (Story: any) => (
  <BrowserRouter>
    <Tooltip.Provider>
      <Story />
    </Tooltip.Provider>
  </BrowserRouter>
);
