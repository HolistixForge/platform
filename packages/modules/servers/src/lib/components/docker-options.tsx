import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/demiurge-ui-components';
import { CheckIcon } from '@radix-ui/react-icons';
import * as Checkbox from '@radix-ui/react-checkbox';

export type DockerOptionsFormData = {
  storage: number;
  memory: number; // Added memory limit
  cpu: number; // Added CPU count
  gpuAccess: 'all' | 'specific'; // Added GPU access configuration
  gpuIds: string;
};

/**
 *
 */

export const DockerOptionsForm = ({
  action,
}: {
  action: TAction<DockerOptionsFormData>;
}) => {
  //

  return (
    <>
      <FormError errors={action.errors} id="storage" />
      <TextFieldset
        type="number"
        label="Storage (Gi)"
        name="storage"
        value={`${action.formData.storage}` || ''}
        placeholder="Storage size"
        onChange={(e) =>
          action.handleChange({ storage: Number(e.target.value) })
        }
        min={1}
        step={1}
      />

      <FormError errors={action.errors} id="memory" />
      <TextFieldset
        type="number"
        label="Memory (MB)"
        name="memory"
        value={`${action.formData.memory}` || ''}
        placeholder="Memory size"
        onChange={(e) =>
          action.handleChange({ memory: Number(e.target.value) })
        }
        min={256}
        step={256}
      />

      <FormError errors={action.errors} id="cpu" />
      <TextFieldset
        type="number"
        label="Number of CPUs"
        name="cpu"
        value={`${action.formData.cpu}` || ''}
        placeholder="Cpu number"
        onChange={(e) => action.handleChange({ cpu: Number(e.target.value) })}
        min={1}
        step={1}
      />

      <FormError errors={action.errors} id="gpuAccess" />
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="gpuAccess">
          GPU Access
        </label>

        <Checkbox.Root
          className="CheckboxRoot"
          value={'gpuAccess'}
          checked={action.formData.gpuAccess === 'all'}
          id={'gpuAccess'}
          onCheckedChange={(v: boolean) =>
            action.handleChange({ gpuAccess: v ? 'all' : 'specific' })
          }
        >
          <Checkbox.Indicator className="CheckboxIndicator">
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>

        <input
          type="checkbox"
          id="gpuAccess"
          name="gpuAccess"
          checked={action.formData.gpuAccess === 'all'}
          onChange={(e) =>
            action.handleChange({
              gpuAccess: e.target.checked ? 'all' : 'specific',
            })
          }
        />
        <label htmlFor="gpuAccess">All</label>
      </fieldset>

      {action.formData.gpuAccess !== 'all' && (
        <TextFieldset
          label="Specific GPU IDs"
          name="gpuIds"
          onChange={(e) => action.handleChange({ gpuIds: e.target.value })}
          value={action.formData.gpuIds}
          placeholder="GPU IDs (number, comma separated)"
        />
      )}

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          {...action}
          handleChange={undefined}
          formData={undefined}
          callback={() => action.callback(action.formData)}
          text="OK"
        />
      </div>
    </>
  );
};
