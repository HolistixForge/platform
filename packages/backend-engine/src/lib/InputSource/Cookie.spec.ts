import { Logger } from '@monorepo/log';
import { Request } from '../Request/Request';
import { Cookie } from './Cookie';
import { Inputs } from './Inputs';

const random1 = 'VJXam9zdzI3ZAXNxbERETUNpYUhTNHZArNkNaMVpLV3VTaUhJNkd621ZAaEc';

const random2 = '1gj9qumljuz';

const oneCookie = `cookie1=${random1}`;

const twoCookies = `cookie1=${random1}; csrfState=${random2}`;

//
//

describe('Testing the cookie parsing', () => {
  Logger.setPriority(7);

  const cookieInput = new Cookie(new Inputs({}));

  it('first of one', async () => {
    const v = cookieInput.get('cookie', ['cookie1'], {
      _data: { headers: { cookie: oneCookie } },
    } as unknown as Request);

    expect(v).toBe(random1);
  });

  it('second of one', async () => {
    const v = cookieInput.get('cookie', ['csrfState'], {
      _data: { headers: { cookie: oneCookie } },
    } as unknown as Request);

    expect(v).toBe(undefined);
  });

  it('first of two', async () => {
    const v = cookieInput.get('cookie', ['cookie1'], {
      _data: { headers: { cookie: twoCookies } },
    } as unknown as Request);

    expect(v).toBe(random1);
  });

  it('second of two', async () => {
    const v = cookieInput.get('cookie', ['csrfState'], {
      _data: { headers: { cookie: twoCookies } },
    } as unknown as Request);

    expect(v).toBe(random2);
  });

  it('none of two', async () => {
    const v = cookieInput.get('cookie', ['nimportequoi'], {
      _data: { headers: { cookie: twoCookies } },
    } as unknown as Request);

    expect(v).toBe(undefined);
  });
});
