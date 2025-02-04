import * as Select from '@radix-ui/react-select';

import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  SelectFieldset,
  SelectItem,
  TextFieldset,
} from '@monorepo/demiurge-ui-components';

export type CloudInstanceOptionsFormData = {
  instanceType: string;
  storage: number;
};

export const CloudInstanceOptionsForm = ({
  action,
}: {
  action: TAction<CloudInstanceOptionsFormData>;
}) => {
  return (
    <>
      <FormError errors={action.errors} id="instanceType" />
      <SelectFieldset
        name="instanceType"
        value={`${action.formData.instanceType}`}
        onChange={(s) => action.handleChange({ instanceType: s })}
        placeholder="Select an instance type…"
        label="Instance type"
        required
      >
        <Select.Group>
          <Select.Label className="SelectLabel">Instance types</Select.Label>
          {awsInstanceTypes.map((type) => (
            <SelectItem key={type.Instance} value={type.Instance}>
              <b>{type.Instance}</b> (vCPUs <b>{type.vCPU}</b> Memory{' '}
              <b>{type.Memory_GiB}</b> GiB)
            </SelectItem>
          ))}
        </Select.Group>
      </SelectFieldset>

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
          text="Create Instance"
        />
      </div>
    </>
  );
};

export const awsInstanceTypes = [
  {
    Instance: 't2.nano',
    vCPU: 1,
    CPU_Credits_per_Hour: 3,
    Memory_GiB: 0.5,
    Storage: 'EBS-Only',
    Network_Performance: 'Low',
  },
  {
    Instance: 't2.micro',
    vCPU: 1,
    CPU_Credits_per_Hour: 6,
    Memory_GiB: 1,
    Storage: 'EBS-Only',
    Network_Performance: 'Low to Moderate',
  },
  {
    Instance: 't2.small',
    vCPU: 1,
    CPU_Credits_per_Hour: 12,
    Memory_GiB: 2,
    Storage: 'EBS-Only',
    Network_Performance: 'Low to Moderate',
  },
  {
    Instance: 't2.medium',
    vCPU: 2,
    CPU_Credits_per_Hour: 24,
    Memory_GiB: 4,
    Storage: 'EBS-Only',
    Network_Performance: 'Low to Moderate',
  },
  {
    Instance: 't2.large',
    vCPU: 2,
    CPU_Credits_per_Hour: 36,
    Memory_GiB: 8,
    Storage: 'EBS-Only',
    Network_Performance: 'Low to Moderate',
  },
  {
    Instance: 't2.xlarge',
    vCPU: 4,
    CPU_Credits_per_Hour: 54,
    Memory_GiB: 16,
    Storage: 'EBS-Only',
    Network_Performance: 'Moderate',
  },
  {
    Instance: 't2.2xlarge',
    vCPU: 8,
    CPU_Credits_per_Hour: 81,
    Memory_GiB: 32,
    Storage: 'EBS-Only',
    Network_Performance: 'Moderate',
  },
];
