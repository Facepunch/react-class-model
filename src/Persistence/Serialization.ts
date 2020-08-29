import { Persistence, getPersistence, requirePersistence } from './Persistence';
import { Field } from './Field';
import isEqual from 'lodash-es/isEqual';

export function toSerializable<T>(instance: T) {
    if (typeof instance === 'string' || typeof instance === 'number' || typeof instance === 'boolean') {
        return instance;
    }

    const persistence = requirePersistence(instance);
    const result = {} as any;

    for (const [name, field] of persistence.fields.entries()) {
        if (field.transient) {
            continue;
        }
        
        let value = field.get(instance);
        if (!value && typeof value !== 'boolean') {
            continue;
        }

        switch (typeof value) {
            case 'object':
                if (Array.isArray(value)) {
                    value = value.map(toSerializable);
                } else {
                    value = toSerializable(value);
                }
                break;
            case 'function':
                throw new Error('Cannot serialize functions');
            case 'symbol':
                throw new Error('Cannot serialize symbols');
        }

        result[name] = value;
    }

    return result;
}

export function deserializeCopy<T>(persistence: Persistence, current: T, props: Object) {
    let changed = false;

    for (const [name, field] of persistence.fields.entries()) {
        let currentProp = field.get(current);
        let newProp = props[name];

        if (typeof newProp === 'undefined') {
            continue;
        }

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
                        const value = (currentProp && currentProp[index]) || field.construct(item);
                        if (deserializeCopy(objPersistence, value, item)) {
                            changed = true;
                        }
                        return value;
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

                if (!newProp) {
                    if (currentProp != newProp) {
                        changed = true;
                    }
                    
                    field.set(current, newProp);
                } else {
                    if (!currentProp) {
                        currentProp = field.construct(newProp);
                        field.set(current, currentProp);
                    }
                    
                    if (deserializeCopy(objPersistence, currentProp, newProp)) {
                        changed = true;
                    }
                }
            }
        } else {
            newProp = field.construct(newProp);
            if (!equals(currentProp, newProp)) {
                field.set(current, newProp);
                changed = true;
            }
        }
    }

    if (changed && typeof current['notifyListeners'] === 'function') {
        current['notifyListeners']();
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

                dest[i] = field.construct(newItem);
                deserializeCopy(persistence, dest[i], newItem);
                changed = true;
            } else {
                // swap
                dest[i] = dest[found];
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
    if (x.constructor === y.constructor && typeof x['equals'] === 'function') {
        return !!x['equals'](y);
    }

    if (x instanceof Date) {
        if (y instanceof Date) {
            return x.valueOf() === y.valueOf();
        }

        if (typeof y === 'number') {
            return x.valueOf() === (y * 1000); // our number timestamps are in seconds, not ms
        }
    }

    return isEqual(x, y);
}
