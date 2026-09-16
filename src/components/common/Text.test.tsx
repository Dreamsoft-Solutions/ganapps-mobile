import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text } from './Text';

describe('Text font family', (): void => {
  it('applies the default sans family when the caller asks for no other', async (): Promise<void> => {
    const screen = await render(<Text>Plain</Text>);

    expect(String(screen.getByText('Plain').props.className)).toContain('font-sans');
  });

  it('does not force the default family over one the caller chose', async (): Promise<void> => {
    // Tailwind emits `.font-sans` after every `.font-inter-*` utility, so a
    // default family kept alongside the caller's would silently win and every
    // bold/semibold class in the app would render regular.
    const screen = await render(<Text className="font-inter-bold text-headline-md">Heading</Text>);
    const className: string = String(screen.getByText('Heading').props.className);

    expect(className).toContain('font-inter-bold');
    expect(className).not.toContain('font-sans');
  });

  it('keeps the theme foreground color regardless of the family', async (): Promise<void> => {
    const screen = await render(<Text className="font-inter-medium">Medium</Text>);

    expect(String(screen.getByText('Medium').props.className)).toContain('text-foreground');
  });
});
