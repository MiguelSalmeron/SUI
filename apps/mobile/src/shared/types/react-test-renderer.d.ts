declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestProps {
    style?: unknown;
    onPress?: () => void;
    accessibilityRole?: string;
    children?: unknown;
    [key: string]: unknown;
  }

  export interface ReactTestInstance {
    readonly type: unknown;
    readonly props: ReactTestProps;
    readonly parent: ReactTestInstance | null;
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    findAllByType(type: unknown): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    readonly root: ReactTestInstance;
    unmount(): void;
  }

  export function create(element: ReactElement): ReactTestRenderer;
}
