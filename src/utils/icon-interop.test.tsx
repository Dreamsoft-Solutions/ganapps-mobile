import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { LucideProvider, Search } from 'lucide-react-native';
import { colorScheme } from 'nativewind';
import './icon-interop';
import { registerCSS } from 'react-native-css-interop/test';

jest.mock('lucide-react-native', (): unknown => ({
  Search: jest.requireActual('../../node_modules/lucide-react-native/dist/cjs/icons/search.js'),
  LucideProvider: (
    jest.requireActual(
      '../../node_modules/lucide-react-native/dist/cjs/context.js',
    ) as typeof import('lucide-react-native')
  ).LucideProvider,
}));

beforeEach((): void => {
  registerCSS(
    '.semantic-icon { color: #111111; } @media (prefers-color-scheme: dark) { .semantic-icon { color: #eeeeee; } }',
  );
});

describe('semantic Lucide colors', (): void => {
  it.each(['light', 'dark'] as const)('maps the %s class to the native icon color', async (theme:
    | 'light'
    | 'dark'): Promise<void> => {
    colorScheme.set(theme);
    const screen = await render(<Search accessibilityLabel="icon" className="semantic-icon" />);
    expect(screen.getAllByLabelText('icon')[0].props.stroke).toBe(theme === 'dark' ? '#eeeeee' : '#111111');
    await screen.unmount();
  });

  it('keeps explicit and button-provider colors when there is no semantic class', async (): Promise<void> => {
    const explicit = await render(<Search accessibilityLabel="icon" color="#123456" />);
    expect(explicit.getAllByLabelText('icon')[0].props.stroke).toBe('#123456');
    await explicit.unmount();
    const provided = await render(
      <LucideProvider color="#654321">
        <Search accessibilityLabel="icon" />
      </LucideProvider>,
    );
    expect(provided.getAllByLabelText('icon')[0].props.stroke).toBe('#654321');
    await provided.unmount();
  });
});
