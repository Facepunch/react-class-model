import { Persistence, getPersistence, requirePersistence } from './Persistence';
import { Field } from './Field';
import isEqual from 'lodash-es/isEqual';
import { Model } from '../Model';

export function toSerializable<T>(instance: T) {
    if (instance === undefined ||
        instance === null ||
        typeof instance === 'string' ||
        typeof instance === 'number' ||
        typeof instance === 'boolean'
    ) {
        return instance;
    }

    if (typeof instance !== 'object') {
        throw new Error(`Cannot serialize ${typeof instance}`);
    }

    const persistence = requirePersistence(instance);
    if (persistence.serialize) {
        return persistence.serialize(instance);
    }

    const result = {} as any;
    for (const [name, field] of persistence.fields.entries()) {
        if (field.transient) {
            continue;
        }
        
        let value = field.get(instance);
        if (value === undefined) {
            continue;
        }

        if (Array.isArray(value)) {
            value = value.map(toSerializable);
        } else {
            value = toSerializable(value);
        }

        result[name] = value;
    }

    return result;
}

export function deserializeCopy<T>(persistence: Persistence, current: T, props: Object) {
    let changed = false;

    for (const [name, field] of persistence.fields.entries()) {
        if (typeof props === 'object' && !props.hasOwnProperty(name)) {
            continue;
        }

        let currentProp = field.get(current);
        let newProp = props[name];

        if (field.copy) {
            field.set(current, newProp);
            changed = true;
            continue;
        }

        if (typeof newProp === 'object' && newProp !== null) {
            const objPersistence = getPersistence(field.ctor, false);

            if (Array.isArray(newProp)) {
                if (objPersistence && objPersistence.keys.length > 0) {
                    if (!Array.isArray(currentProp)) {
                        currentProp = [];
                        field.set(current, currentProp);
                    }

                    if (mergeArray(objPersistence, field, currentProp, newProp)) {
                        changed = true;
                    }
                } else if (objPersistence) {
                    currentProp = newProp.map((item, index) => {
                        const [updated, newValue] = field.deserialize(item, currentProp?.[index]);
                        changed = changed || updated;
                        return newValue;
                    });

                    if (changed) {
                        field.set(current, currentProp);
                    }
                } else {
                    field.set(current, newProp);
                    changed = true;
                }
            } else {
                if (!objPersistence) {
                    console.error(`Constructor is required for @prop('${name}')`);
                    continue;
                }

                const [updated, newValue] = field.deserialize(newProp, currentProp);
                if (updated) {
                    field.set(current, newValue);
                    changed = true;
                }
            }
        } else {
            const [updated, newValue] = field.deserialize(newProp, currentProp);
            if (updated) {
                field.set(current, newValue);
                changed = true;
            }
        }
    }

    if (changed && current instanceof Model) {
        current.notifyListeners();
    }

    return changed;
}

function mergeArray(persistence: Persistence, field: Field, dest: any[], source: any[]) {
    let changed = false;

    while (source.length > dest.length) {
        dest.push(null);
        changed = true;
    }

    for (let i = 0; i < source.length; i++) {
        const oldItem = dest[i];
        const newItem = source[i];

        if (oldItem && keysMatch(persistence, oldItem, newItem)) {
            if (deserializeCopy(persistence, oldItem, newItem)) {
                changed = true;
            }
        } else {
            let found = -1;
            for (let j = i + 1; j < dest.length; j++) {
                const item = dest[j];
                if (item && keysMatch(persistence, item, newItem)) {
                    found = j;
                    break;
                }
            }

            if (found < 0) {
                if (oldItem) {
                    dest.push(oldItem); // save it for later
                }

                const [_, newValue] = field.deserialize(newItem, undefined);
                dest[i] = newValue;
                changed = true;
            } else {
                // swap
                if (i !== found) {
                    dest[i] = dest[found];
                    changed = true;
                }

                if (oldItem) {
                    dest[found] = oldItem;
                } else {
                    dest.splice(found, 1);
                }

                if (deserializeCopy(persistence, dest[i], newItem)) {
                    changed = true;
                }
            }
        }
    }

    while (dest.length > source.length) {
        dest.pop();
        changed = true;
    }

    return changed;
}

function keysMatch(persistence: Persistence, obj: object, props: any) {
    if (typeof props === 'object') {
        for (let i = 0; i < persistence.keys.length; i++) {
            const key = persistence.keys[i];
            const field = persistence.fields.get(key);
            if (!equals(field.get(obj), props[key])) {
                return false;
            }
        }

        return true;
    } else {
        const field = persistence.fields.get(persistence.keys[0]);
        return equals(field.get(obj), props);
    }
}

function equals(x: object, y: object) {
    // for any class that has an equals method - x.equals(y)
    if (typeof x === 'object' &&
        typeof y === 'object' &&
        x.constructor === y.constructor &&
        typeof x['equals'] === 'function'
    ) {
        return !!x['equals'](y);
    }

    if (x instanceof Date) {
        if (y instanceof Date) {
            return x.valueOf() === y.valueOf();
        }

        if (typeof y === 'number') {
            return x.valueOf() === (y * 1000); // assume numbers are unix timestamps (in seconds)
        }
    }

    return isEqual(x, y);
}
