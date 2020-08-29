import { Constructor, AnyTyped, ConstructorBinder } from './CommonTypes';
import { requirePersistence, getPersistence } from './Persistence';
import { Model } from '../Model';
import { toSerializable, deserializeCopy } from './Serialization';
import { Field } from './Field';

export function serialize<T>(value: T) {
    const serializable = toSerializable(value);
    return JSON.stringify(serializable);
}

export function deserialize<T>(ctor: Constructor<T>, json: string): T {
    const instance = new ctor();
    deserializeInto(instance, json);
    return instance;
}

export function deserializeInto<T>(value: T, json: string) {
    const persistence = requirePersistence(value);
    const obj = JSON.parse(json) as Object;
    return deserializeCopy(persistence, value, obj);
}

export function copyInto<TInstance extends AnyTyped<TProps>, TProps>(value: TInstance, props: TProps) {
    const persistence = requirePersistence(value);
    return deserializeCopy(persistence, value, props);
}

interface PropParams {
    ctor?: Constructor<any>;
    transient?: boolean;
    key?: string;
    copy?: boolean;
}

// Decorator which sets up a field for serialization.
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

// Decorator which sets fields to act as a key for object merging.
export function key<T extends Model>(target: T, propertyKey: string, prevDesc?: any): any {
    const persistence = getPersistence(target, true);
    persistence.keys.push(propertyKey);
}

interface PersistenceAccessor<T> {
    get: (instance: T) => any;
    set: (instance: T, value: any) => void;
}

interface PersistenceInit<T> {
    binder?: ConstructorBinder | string[],
    fields: {
        [name: string]: keyof T | PersistenceAccessor<T>;
    };
}

// Sets up custom serialization behavior for a type.
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

        const getter = isFieldName(fieldInit)
            ? (instance: T) => instance[fieldInit]
            : fieldInit.get;

        const setter = isFieldName(fieldInit)
            ? (instance: T, value: any) => instance[fieldInit] = value
            : fieldInit.set;

        const field = new Field(null, false, false, getter, setter);
        persistence.fields.set(name, field);
    }
}

function isFieldName<T>(name: keyof T | PersistenceAccessor<T>): name is keyof T {
    return typeof name === 'string';
}
