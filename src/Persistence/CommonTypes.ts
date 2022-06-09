export type Constructor<T> = new (...args: any[]) => T;
export type PropConstructor<T> = Constructor<T> | { value?: Constructor<T> };
export type Getter<T> = (instance: T) => any;
export type Setter<T> = (instance: T, value: any) => void;
export type DeserializeResult<T = any> = [boolean, T];
export type Serializer<T = any> = (value: T) => any;
export type Deserializer<T = any> = (value: any) => T;
export type InPlaceDeserializer<T = any> = (value: any, instance: T) => boolean;

export type AnyTyped<T> = {
    [TKey in keyof T]: any;
};
