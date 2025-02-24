import * as Select from '@radix-ui/react-select';

import { TG_ServerImage } from '@monorepo/frontend-data';
import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  SelectFieldset,
  SelectItem,
  TextFieldset,
} from '@monorepo/ui-base';

/**
 *
 */

export type NewServerFormData = {
  imageId: number | undefined;
  serverName: string;
};

/**
 *
 */

export const NewServerForm = ({
  images,
  action,
}: {
  images?: TG_ServerImage[];
  action: TAction<NewServerFormData>;
}) => {
  //

  return (
    <>
      <FormError errors={action.errors} id="serverName" />
      <TextFieldset
        label="Name"
        name="serverName"
        onChange={action.handleInputChange}
        value={action.formData.serverName}
        placeholder="Server name"
      />

      <FormError errors={action.errors} id="imageId" />
      <SelectFieldset
        name="imageId"
        value={`${action.formData.imageId}`}
        onChange={(s) => action.handleChange({ imageId: parseInt(s) })}
        placeholder="Select a server image…"
        label="Image"
        required
      >
        <Select.Group>
          <Select.Label className="SelectLabel">Images</Select.Label>
          {images &&
            images.map((i) => (
              <SelectItem
                key={i.image_id}
                value={`${i.image_id}`}
                title={`${i.image_sha256?.substring(0, 10)}...`}
              >
                {i.image_name}: {i.image_tag}
              </SelectItem>
            ))}
        </Select.Group>
      </SelectFieldset>

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create server"
          loading={action.loading}
        />
      </div>
    </>
  );
};
