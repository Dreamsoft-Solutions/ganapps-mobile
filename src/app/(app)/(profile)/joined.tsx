import type { ReactElement } from 'react';
import { JoinedGanapsList } from '@/components/profile/JoinedGanapsList';

/**
 * Full list of Ganaps joined by the current User.
 *
 * @returns The paginated joined Ganap list.
 */
export default function JoinedGanapsScreen(): ReactElement {
  return <JoinedGanapsList />;
}
