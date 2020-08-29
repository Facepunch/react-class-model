export type Constructor<T> = new (...args: any[]) => T;
export type ConstructorBinder = (props: any) => any[];
export type Getter<T> = (instance: T) => any;
export type Setter<T> = (instance: T, value: any) => void;

export type AnyTyped<T> = {
    [TKey in keyof T]: any;
};
