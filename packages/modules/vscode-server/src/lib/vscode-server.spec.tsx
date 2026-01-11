import { render } from '@testing-library/react';

import VscodeServer from './vscode-server';

describe('VscodeServer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<VscodeServer />);
    expect(baseElement).toBeTruthy();
  });
});
