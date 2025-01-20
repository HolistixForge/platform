export const secondAgo = (d1: string | Date, d2?: string | Date) => {
  let date1, date2;
  if (typeof d1 === 'string') date1 = new Date(d1);
  else date1 = d1;

  if (!d2) date2 = new Date();
  else if (typeof d2 === 'string') date2 = new Date(d2);
  else date2 = d2;

  return (date2.getTime() - date1.getTime()) / 1000;
};

export const inSeconds = (seconds: number, n?: Date) => {
  if (!n) n = new Date();
  n.setSeconds(n.getSeconds() + seconds);
  return n;
};

export const isPassed = (d: Date) => {
  return d.getTime() <= new Date().getTime();
};

export const sleep = (seconde = 1) =>
  new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconde * 1000);
  });

export const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;
