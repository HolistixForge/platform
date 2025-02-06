import { icons } from '../assets/icons';
import { Accordion } from '../accordion/Accordion';

import './preview.css';
import { useTestBoolean } from '../storybook-utils';

export const Preview = () => {
  const { is: isOpened, set: open, unset: close } = useTestBoolean(false);

  const accordionData = [
    {
      title: 'Serializer',
      functionName: 'func name 1',
      content: `Lorem ipsum dolor, sit amet consectetur adipisicing elit. Quis sapiente
          laborum cupiditate possimus labore, hic temporibus velit dicta earum
          suscipit commodi eum enim atque at? Et perspiciatis dolore iure
          voluptatem.`,
    },
    {
      title: 'Unserailizer',
      functionName: 'func name 2',
      content: `Lorem ipsum, dolor sit amet consectetur adipisicing elit. Mollitia veniam
          reprehenderit nam assumenda voluptatem ut. Ipsum eius dicta, officiis
          quaerat iure quos dolorum accusantium ducimus in illum vero commodi
          pariatur? Impedit autem esse nostrum quasi, fugiat a aut error cumque
          quidem maiores doloremque est numquam praesentium eos voluptatem amet!
          Repudiandae, mollitia id reprehenderit a ab odit!`,
    },
    {
      title: 'sampler',
      functionName: 'func name 3',
      content: `Sapiente expedita hic obcaecati, laboriosam similique omnis architecto ducimus magnam accusantium corrupti
          quam sint dolore pariatur perspiciatis, necessitatibus rem vel dignissimos
          dolor ut sequi minus iste? Quas?`,
    },
  ];

  return (
    <div className="preview">
      <div className="preview-header">
        <ul>
          <li>
            <icons.Expended />
          </li>
          <li>
            <icons.Lock />
          </li>
          <li>
            <icons.Fullscreen />
          </li>
          <li>
            <icons.Settings />
          </li>
        </ul>
        <div className="info">
          <p>data</p>
          <span>STR</span>
        </div>
      </div>
      <div className="accordion">
        {accordionData.map(({ title, content, functionName }, k) => (
          <Accordion
            key={k}
            title={title}
            functionName={functionName}
            content={content}
            isOpened={isOpened}
            open={open}
            close={close}
          />
        ))}
      </div>
      <hr />
      <textarea name="description" id="0"></textarea>
    </div>
  );
};
