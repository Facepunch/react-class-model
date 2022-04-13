import { Constructor, AnyTyped, Serializer, Deserializer, InPlaceDeserializer } from './CommonTypes';
import { requirePersistence, getPersistence } from './Persistence';
import { Model } from '../Model';
import { toSerializable, deserializeCopy } from './Serialization';
import { Field } from './Field';

/**
 * Serializes the provided model to JSON.
 * @param value The model to serialize.
 * @returns The JSON representation of the model.
 * @remarks This performs serialization logic according to {@link prop()} decorators on the model type.
 */
export function serialize<T extends Model>(value: T) {
    const serializable = toSerializable(value);
    return JSON.stringify(serializable);
}

/**
 * Deserializes JSON to a new instance of a model.
 * @param ctor The model type that is being deserialized.
 * @param json The JSON to deserialize.
 * @returns A new instance of the model with fields deserialized from the JSON.
 * @remarks This performs deserialization logic according to {@link prop()} decorators on the model type.
 */
export function deserialize<T extends Model>(ctor: Constructor<T>, json: string): T {
    const instance = new ctor();
    deserializeInto(instance, json);
    return instance;
}

/**
 * Deserializes JSON to an existing instance of a model.
 * @param value The existing instance of the model to deserialize into.
 * @param json The JSON to deserialize.
 * @remarks This performs deserialization logic according to {@link prop()} decorators on the model type.
 */
export function deserializeInto<T extends Model>(value: T, json: string) {
    const persistence = requirePersistence(value);
    const obj = JSON.parse(json) as Object;
    return deserializeCopy(persistence, value, obj);
}

/**
 * Deserializes a JavaScript object to an existing instance of a model.
 * @param value The existing instance of the model to deserialize into.
 * @param props The JavaScript object to deserialize from.
 * @remarks This performs deserialization logic according to {@link prop()} decorators on the model type.
 */
export function copyInto<TInstance extends Model & AnyTyped<TProps>, TProps>(value: TInstance, props: TProps) {
    const persistence = requirePersistence(value);
    return deserializeCopy(persistence, value, props);
}

interface PropParams {
    /**
     * Specifies the expected type of this field. Required if the field is not a primitive type.
     */
    readonly ctor?: Constructor<any>;

    /**
     * Disables serialization of this field but allows deserialization.
     */
    readonly transient?: boolean;

    /**
     * Overrides the name of this field when serialized to JSON.
     */
    readonly key?: string;

    /**
     * Disables deserialization processing on this field's value. Deserialization will copy the value as-is from the parsed JSON without performing merging etc.
     */
    readonly copy?: boolean;
}

/**
 * Field decorator which sets up serialization for the field.
 * @param props Parameters on how to handle serialization of this field.
 */
export function prop(props?: PropParams) {
    const ctor = props && props.ctor;
    const transient = props && props.transient;
    const key = props && props.key;
    const copy = props && props.copy;
    
    return <T>(target: T, propertyName: string, ...a: any[]) => {
        const field = new Field(ctor, transient, copy,
            instance => instance[propertyName],
            (instance, value) => instance[propertyName] = value);

        getPersistence(target, true).add(key || propertyName, field);
    };
}

/**
 * Decorator which sets fields to act as an identifiable key for object merging.
 * This allows instances within arrays to be updated without creating a new instance of the model.
 * Multiple fields may be marked as keys to form a composite key.
 */
export function key<T>(target: T, propertyKey: string, prevDesc?: any): any {
    const persistence = getPersistence(target, true);
    persistence.keys.push(propertyKey);
}

interface SerializationOptions<T> {
    readonly serialize: Serializer<T>;

    readonly deserialize: Deserializer<T>;

    readonly deserializeInto?: InPlaceDeserializer<T>;
}

/**
 * Sets up custom serialization/deserialization behavior for a primitive-like type.
 * @param ctor The field type being set up.
 * @param options Options for how to handle serialization for fields of this type.
 * @remarks Model serialization is handled automatically using the {@link prop()} decorator so you should not call this for models.
 */
export function setupSerialization<T>(ctor: Constructor<T>, options: SerializationOptions<T>) {
    const persistence = getPersistence(ctor, true);

    if (persistence.fields.size > 0) {
        throw new Error('The provided type has fields defined - you should not call setupPersistence for model types.');
    }
        
    persistence.serialize = options.serialize;
    persistence.deserialize = options.deserialize;
    persistence.deserializeInto = options.deserializeInto;
}
