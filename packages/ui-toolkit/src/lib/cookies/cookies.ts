//

export const getCookies = () => {
  const cookies = document.cookie.split(';').map((c) => c.trim().split('='));
  return cookies;
};

//

export const getCookie = (name: string, json = false) => {
  const cs = getCookies();
  const c = cs.find((c) => c[0] === name);
  if (c) {
    const v = decodeURIComponent(c[1]);
    if (json) return JSON.parse(v);
    else return v;
  } else return undefined;
};

