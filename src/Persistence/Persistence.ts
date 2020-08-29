import { ConstructorBinder } from './CommonTypes';
import { Field } from './Field';

export class Persistence {
    public binder: ConstructorBinder;
    public fields: Map<string, Field> = new Map();
    public keys: string[] = [];

    public add(name: string, field: Field) {
        if (this.fields.has(name)) {
            throw new Error(`Duplicate field with name '${name}'`);
        }

        this.fields.set(name, field);
    }
}

export function requirePersistence(value: any) {
    if (!value) {
        throw new Error('Cannot serialize null/falsy value');
    }

    let persistence = getPersistence(value);
    if (!persistence) {
        throwPersistenceRequired(value);
        return;
    }

    return persistence;
}

export function throwPersistenceRequired(value: any) {
    const name = value.name || value.constructor.name;
    throw new Error(`Type '${name}' has no persistence defined. Use the @prop decorator to set it up.`);
}

export function getPersistence(obj: any, create: boolean = false) {
    const key = '__persistence';

    if (!obj) {
        return null;
    }

    let value = obj[key] as Persistence;
    
    if (!value && obj.prototype) {
        value = obj.prototype[key];
    }

    if (!value && obj.constructor) {
        value = obj.constructor[key];
    }

    if (create && !value) {
        value = new Persistence();
        obj[key] = value;
    }

    return value;
}
