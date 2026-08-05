import { error } from '@holistix-forge/log';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import {
  Format,
  OpenAPIV3,
  OpenApiValidatorOpts,
} from 'express-openapi-validator/dist/framework/types';

const formats: Record<string, Format> = {
  password: {
    name: '',
    type: 'string',
    // validate returns true the string has 3 letters, false otherwise
    validate: (v) => {
      const passwordRegex =
        /^(?=.*\d)(?=.*[A-Z])(?=.*[a-z])(?=.*[^a-zA-Z\d]).*$/;
      const minLength = 10;
      return v.length >= minLength && passwordRegex.test(v);
    },
  },
};

//

export const setupValidator = (
  app: express.Express,
  options?: OpenApiValidatorOpts
) => {
  app.use(
    OpenApiValidator.middleware({
      apiSpec: {} as OpenAPIV3.DocumentV3, // Provide a default empty object if oas is undefined
      // apiSpec: oas as OpenAPIV3.Document,
      validateFormats: true,
      /**
       * A route missing from the spec is undocumented, not absent.
       *
       * This middleware sits in front of the router, and its default is to
       * answer 404 for any path the OpenAPI document does not describe — so a
       * route that exists, compiles, has tests and is registered still cannot
       * be called, and says "not found" while doing it.
       *
       * That had happened, silently, to everything added since the spec was
       * last touched: `/runners` and the four gateway-only `/internal/…`
       * routes, including the one the container broker resolves every image
       * through. Nothing had ever run against a real Ganymede, so nothing
       * said. Found by standing one up (`scripts/local-dev/macos/ganymede-apple.sh`).
       *
       * Documenting them is the other half and is worth doing. It is not what
       * belongs here: an endpoint that disappears because someone forgot to
       * describe it is a loss by omission, and the fix for those is to make
       * the omission unable to take anything away. The validator now checks
       * what it knows and passes through what it does not.
       */
      ignoreUndocumented: true,

      formats: formats as any,
      validateResponses: {
        removeAdditional: 'failing',
        onError: (err, body, req) => {
          // filter out error about Date object from Sql resulset
          // that are not string but are serialize anyway eventually.
          // TODO: may filter out other legit errors
          if (!err.message.includes(' must be string')) {
            error('OUTPUTS', `Response body fails validation: `, err.message);
            error('OUTPUTS', `Emitted from: [${req.originalUrl}]`, body);
          }
        },
      },
      ...options,
    })
  );
};
