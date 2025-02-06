import * as Slider from '@radix-ui/react-slider';

import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/ui-base';

/**
 *
 */

export type NewVolumeFormData = { name: string; storage: number };

/**
 *
 */

export const NewVolumeForm = ({
  action,
}: {
  action: TAction<NewVolumeFormData>;
}) => {
  //

  return (
    <>
      <FormError errors={action.errors} id="name" />
      <TextFieldset
        label="Name"
        name="name"
        onChange={action.handleInputChange}
        value={action.formData.name}
        placeholder="Volume name"
      />
      <FormError errors={action.errors} id="imageId" />
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="storage">
          Storage (Gi)
        </label>
        <Slider.Root
          style={{ width: '230px', maxWidth: '230px' }}
          className="SliderRoot"
          defaultValue={[1]}
          onValueChange={(v: number[]) => {
            action.handleChange({ storage: v[0] });
          }}
          min={1}
          max={20}
          step={1}
        >
          <Slider.Track className="SliderTrack">
            <Slider.Range className="SliderRange" />
          </Slider.Track>
          <Slider.Thumb className="SliderThumb" />
        </Slider.Root>
        <span className="SliderValue">{action.formData.storage} Gi</span>
      </fieldset>
      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Create Volume"
          loading={action.loading}
        />
      </div>
    </>
  );
};
