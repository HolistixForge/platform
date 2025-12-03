import { error } from '@holistix/log';
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
