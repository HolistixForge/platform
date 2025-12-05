import { render } from '@testing-library/react';

import N8n from './n8n';

describe('N8n', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<N8n />);
    expect(baseElement).toBeTruthy();
  });
});
