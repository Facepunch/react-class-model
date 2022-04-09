import { Constructor, AnyTyped, ConstructorBinder } from './CommonTypes';
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
    ctor?: Constructor<any>;

    /**
     * Disables serialization of this field but allows deserialization.
     */
    transient?: boolean;

    /**
     * Overrides the name of this field when serialized to JSON.
     */
    key?: string;

    /**
     * Disables deserialization processing on this field's value. Deserialization will copy the value as-is from the parsed JSON without performing merging etc.
     */
    copy?: boolean;
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
    
    return <T>(target: T, propertyName: string) => {
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
export function key<T extends Model>(target: T, propertyKey: string, prevDesc?: any): any {
    const persistence = getPersistence(target, true);
    persistence.keys.push(propertyKey);
}

interface PersistenceAccessor<T> {
    /**
     * Reads the value of a field from the instance and returns the value to store in the serialized JSON.
     * This may be used to perform extra mapping logic when serializing.
     */
    get: (instance: T) => any;

    /**
     * Writes a new value to a field in the instance from the serialized JSON.
     * This may be used to perform extra mapping logic when deserializing.
     */
    set: (instance: T, value: any) => void;
}

interface PersistenceInit<T> {
    /**
     * Must be set if this type must be instantiated through its constructor.
     * Can be set to a list of the field names to use for constructor arguments if deserializing from an object.
     * Otherwise, set this to a function which returns the constructor arguments to use.
     */
    binder?: ConstructorBinder | (keyof T & string)[],

    /**
     * Mapping of fields in instances of this type which will be handled by serialization.
     * @remarks The key is the name of the value in the JSON.
     */
    fields: {
        [name: string]: keyof T | PersistenceAccessor<T>;
    };
}

/**
 * Sets up custom serialization/deserialization behavior for a type.
 * @param ctor The field type being set up.
 * @param init Configuration for how to treat fields of this type.
 */
export function setupPersistence<T>(ctor: Constructor<T>, init: PersistenceInit<T>) {
    const persistence = getPersistence(ctor, true);
    
    if (Array.isArray(init.binder)) {
        if (persistence.keys.length > 0) {
            console.warn('setupPersistence: keys already defined on type, overwriting');
        }

        persistence.keys = init.binder;
    } else if (init.binder) {
        if (persistence.binder) {
            console.warn('setupPersistence: binder already defined on type, overwriting');
        }

        persistence.binder = init.binder;
    }

    for (const name in init.fields) {
        if (persistence.fields.has(name)) {
            console.warn(`setupPersistence: field ${name} alredy defined on type, ignoring`);
            continue;
        }

        const fieldInit = init.fields[name];

        const getter = isAccessor(fieldInit)
            ? fieldInit.get
            : (instance: T) => instance[fieldInit];

        const setter = isAccessor(fieldInit)
            ? fieldInit.set
            : (instance: T, value: any) => instance[fieldInit] = value;

        const field = new Field(null, false, false, getter, setter);
        persistence.fields.set(name, field);
    }
}

function isAccessor<T>(name: keyof T | PersistenceAccessor<T>): name is PersistenceAccessor<T> {
    return typeof name !== 'string';
}
