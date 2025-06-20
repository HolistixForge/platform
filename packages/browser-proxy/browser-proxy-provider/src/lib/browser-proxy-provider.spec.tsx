import { render } from '@testing-library/react';

import BrowserProxyProvider from './browser-proxy-provider';

describe('BrowserProxyProvider', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<BrowserProxyProvider />);
    expect(baseElement).toBeTruthy();
  });
});
