import { render } from '@testing-library/react';

import Pgadmin4 from './pgadmin4';

describe('Pgadmin4', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Pgadmin4 />);
    expect(baseElement).toBeTruthy();
  });
});
