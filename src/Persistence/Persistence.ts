import { Deserializer, InPlaceDeserializer, Serializer } from './CommonTypes';
import { Field } from './Field';

export class Persistence {
    public serialize: Serializer | null = null;
    public deserialize: Deserializer | null = null;
    public deserializeInto: InPlaceDeserializer | null = null;

    public fields: Map<string, Field> = new Map();
    public keys: string[] = [];

    public add(name: string, field: Field) {
        if (this.serialize || this.deserialize || this.deserializeInto) {
            throw new Error('setupPersistence was called for a model type - cannot continue.');
        }
        
        if (this.fields.has(name)) {
            throw new Error(`Duplicate field with name '${name}'`);
        }

        this.fields.set(name, field);
    }
}

export function requirePersistence(value: any, create: boolean = false) {
    if (!value) {
        throw new Error('Cannot serialize null/falsy value');
    }

    let persistence = getPersistence(value, create);
    if (!persistence) {
        throw persistenceRequiredError(value);
    }

    return persistence;
}

export function persistenceRequiredError(value: any): Error {
    const name = value.name || value.constructor.name;
    return new Error(`Type '${name}' has no persistence defined. Use the @prop decorator to set it up.`);
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
