import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
  SliderFieldset,
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
      <SliderFieldset
        label="Storage (Gi)"
        name="storage"
        value={action.formData.storage}
        onChange={(v: number) => action.handleChange({ storage: v })}
        min={1}
        max={20}
        step={1}
        valueSuffix="Gi"
      />
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
