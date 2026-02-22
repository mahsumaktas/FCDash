// Type stubs for packages not yet installed in node_modules.
// These will be superseded once `npm install` runs correctly.
// Needed because node_modules is owned by root and cannot be modified.

declare module "zustand" {
  type SetState<T> = {
    (partial: Partial<T> | ((state: T) => Partial<T>)): void;
  };
  type GetState<T> = () => T;
  type StoreApi<T> = {
    getState: GetState<T>;
    setState: SetState<T>;
    subscribe: (listener: (state: T, prevState: T) => void) => () => void;
    destroy: () => void;
  };
  type StateCreator<T> = (set: SetState<T>, get: GetState<T>, api: StoreApi<T>) => T;
  export function create<T>(initializer: StateCreator<T>): {
    (): T;
    <U>(selector: (state: T) => U): U;
  };
}

declare module "sonner" {
  import type { FC, ReactNode } from "react";
  export interface ToasterProps {
    position?: "top-left" | "top-right" | "top-center" | "bottom-left" | "bottom-right" | "bottom-center";
    theme?: "light" | "dark" | "system";
    richColors?: boolean;
    expand?: boolean;
    duration?: number;
    visibleToasts?: number;
    closeButton?: boolean;
    className?: string;
    style?: React.CSSProperties;
    offset?: string | number;
    dir?: "ltr" | "rtl" | "auto";
    hotkey?: string[];
    invert?: boolean;
    toastOptions?: Record<string, unknown>;
    gap?: number;
    loadingIcon?: ReactNode;
    pauseWhenPageIsHidden?: boolean;
    icons?: Record<string, ReactNode>;
  }
  export const Toaster: FC<ToasterProps>;
  export function toast(message: string | ReactNode, data?: Record<string, unknown>): string | number;
  export namespace toast {
    function success(message: string | ReactNode, data?: Record<string, unknown>): string | number;
    function error(message: string | ReactNode, data?: Record<string, unknown>): string | number;
    function warning(message: string | ReactNode, data?: Record<string, unknown>): string | number;
    function info(message: string | ReactNode, data?: Record<string, unknown>): string | number;
    function loading(message: string | ReactNode, data?: Record<string, unknown>): string | number;
    function dismiss(id?: string | number): void;
  }
}

declare module "clsx" {
  export type ClassValue = string | number | bigint | boolean | ClassArray | ClassDictionary | null | undefined;
  export type ClassDictionary = Record<string, unknown>;
  export type ClassArray = ClassValue[];
  export function clsx(...inputs: ClassValue[]): string;
  export default clsx;
}

declare module "tailwind-merge" {
  export function twMerge(...classLists: Array<string | undefined | null | false>): string;
}

declare module "class-variance-authority" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type VariantProps<T extends (...args: any[]) => any> = Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function cva(base?: string, config?: Record<string, any>): (...args: any[]) => string;
}

declare module "radix-ui" {
  import type { FC, PropsWithChildren, ReactNode } from "react";

  // Generic radix primitive component props
  type RadixProps = Record<string, unknown> & {
    className?: string;
    children?: ReactNode;
    asChild?: boolean;
  };

  type RadixFC = FC<RadixProps>;

  // Avatar
  export const Avatar: {
    Root: RadixFC;
    Image: RadixFC;
    Fallback: RadixFC;
  };

  // Dialog (also used as Sheet)
  export const Dialog: {
    Root: RadixFC;
    Trigger: RadixFC;
    Portal: RadixFC;
    Overlay: RadixFC;
    Content: RadixFC;
    Close: RadixFC;
    Title: RadixFC;
    Description: RadixFC;
  };

  // DropdownMenu
  export const DropdownMenu: {
    Root: RadixFC;
    Trigger: RadixFC;
    Portal: RadixFC;
    Content: RadixFC;
    Group: RadixFC;
    Item: RadixFC;
    CheckboxItem: RadixFC;
    RadioGroup: RadixFC;
    RadioItem: RadixFC;
    ItemIndicator: RadixFC;
    Label: RadixFC;
    Separator: RadixFC;
    Sub: RadixFC;
    SubTrigger: RadixFC;
    SubContent: RadixFC;
  };

  // Label
  export const Label: {
    Root: RadixFC;
  };

  // Popover
  export const Popover: {
    Root: RadixFC;
    Trigger: RadixFC;
    Portal: RadixFC;
    Content: RadixFC;
    Anchor: RadixFC;
  };

  // ScrollArea
  export const ScrollArea: {
    Root: RadixFC;
    Viewport: RadixFC;
    ScrollAreaScrollbar: RadixFC;
    ScrollAreaThumb: RadixFC;
    Corner: RadixFC;
  };

  // Select
  export const Select: {
    Root: RadixFC;
    Trigger: RadixFC;
    Value: RadixFC;
    Icon: RadixFC;
    Portal: RadixFC;
    Content: RadixFC;
    Viewport: RadixFC;
    Group: RadixFC;
    Label: RadixFC;
    Item: RadixFC;
    ItemText: RadixFC;
    ItemIndicator: RadixFC;
    Separator: RadixFC;
    ScrollUpButton: RadixFC;
    ScrollDownButton: RadixFC;
  };

  // Separator
  export const Separator: {
    Root: RadixFC;
  };

  // Slot
  export const Slot: {
    Root: RadixFC;
  };

  // Switch
  export const Switch: {
    Root: RadixFC;
    Thumb: RadixFC;
  };

  // Tabs
  export const Tabs: {
    Root: RadixFC;
    List: RadixFC;
    Trigger: RadixFC;
    Content: RadixFC;
  };

  // Tooltip
  export const Tooltip: {
    Provider: RadixFC;
    Root: RadixFC;
    Trigger: RadixFC;
    Portal: RadixFC;
    Content: RadixFC;
    Arrow: RadixFC;
  };
}

declare module "cmdk" {
  import type { FC, ReactNode } from "react";

  type CmdkProps = Record<string, unknown> & {
    className?: string;
    children?: ReactNode;
  };

  type CmdkFC = FC<CmdkProps>;

  export const Command: CmdkFC & {
    Input: CmdkFC;
    List: CmdkFC;
    Empty: CmdkFC;
    Group: CmdkFC;
    Item: CmdkFC;
    Separator: CmdkFC;
  };
}

declare module "framer-motion" {
  import type { FC, ReactNode } from "react";
  type MotionProps = Record<string, unknown> & {
    className?: string;
    children?: ReactNode;
  };
  export const motion: Record<string, FC<MotionProps>>;
  export const AnimatePresence: FC<MotionProps>;
}

declare module "recharts" {
  import type { FC, ReactNode } from "react";
  type ChartProps = Record<string, unknown> & {
    className?: string;
    children?: ReactNode;
  };
  export const AreaChart: FC<ChartProps>;
  export const Area: FC<ChartProps>;
  export const BarChart: FC<ChartProps>;
  export const Bar: FC<ChartProps>;
  export const LineChart: FC<ChartProps>;
  export const Line: FC<ChartProps>;
  export const PieChart: FC<ChartProps>;
  export const Pie: FC<ChartProps>;
  export const Cell: FC<ChartProps>;
  export const XAxis: FC<ChartProps>;
  export const YAxis: FC<ChartProps>;
  export const CartesianGrid: FC<ChartProps>;
  export const Tooltip: FC<ChartProps>;
  export const ResponsiveContainer: FC<ChartProps>;
}
