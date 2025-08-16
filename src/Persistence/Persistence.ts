import { Constructor, Deserializer, InPlaceDeserializer, Serializer } from './CommonTypes';
import { Field } from './Field';

export class Persistence {
    public serialize: Serializer | null = null;
    public deserialize: Deserializer | null = null;
    public deserializeInto: InPlaceDeserializer | null = null;

    public fields: Map<string | symbol, Field> = new Map();
    public keys: (string | symbol)[] = [];

    public add(name: string | symbol, field: Field) {
        if (this.serialize || this.deserialize || this.deserializeInto) {
            throw new Error('setupPersistence was called for a model type - cannot continue.');
        }
        
        if (this.fields.has(name)) {
            throw new Error(`Duplicate field with name '${name.toString}'`);
        }

        this.fields.set(name, field);
    }
}

export function requirePersistence(ctor: Function, create: boolean = false) {
    if (!ctor) {
        throw new Error('Cannot serialize null/falsy value');
    }

    let persistence = getPersistence(ctor, create);
    if (!persistence) {
        throw persistenceRequiredError(ctor);
    }

    return persistence;
}

export function persistenceRequiredError(ctor: Function): Error {
    const name = ctor.constructor.name;
    return new Error(`Type '${name}' has no persistence defined. Use the @prop decorator to set it up.`);
}

export function getPersistence(ctor: Function | null | undefined, create: boolean = false) {
    const key = '__persistence';

    if (!ctor) {
        return null;
    }

    let value = ctor[key] as Persistence;

    if (create && !value) {
        value = new Persistence();
        ctor[key] = value;
    }

    return value;
}
