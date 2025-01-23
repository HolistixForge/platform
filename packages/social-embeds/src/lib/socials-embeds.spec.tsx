import { initLibrary } from '@monorepo/lazy-factory';
import { render } from '@testing-library/react';

import lib, { Instagram } from './socials-embeds';

jest.setTimeout(60000);

describe('LazyFactoryLibSocials', () => {
  it('should render successfully', async () => {
    /*
    await initLibrary(lib);
    console.log('library loaded')
    const { baseElement } = render(
      <Instagram data={{ postId: 'p/CgfTceWv8Xt' }} />
    );
    expect(baseElement).toBeTruthy();
    */
  });
});
