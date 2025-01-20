import { render } from '@testing-library/react';

import DemiurgeUiComponents from './demiurge-ui-components';

describe('DemiurgeUiComponents', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DemiurgeUiComponents />);
    expect(baseElement).toBeTruthy();
  });
});
