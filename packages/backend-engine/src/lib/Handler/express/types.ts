export type TStart = {
  port: number;
  host: string;
  certificate?: {
    certFile: string;
    keyfile: string;
  };
};

