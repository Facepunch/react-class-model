import { Deserializer, InPlaceDeserializer, Serializer } from './CommonTypes';
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
    const name = ctor.name;
    return new Error(`Type '${name}' has no persistence defined. Use the @prop decorator to set it up.`);
}

const persistenceSymbol = Symbol('react-class-model:persistence');
const initializationCompleteSymbol = Symbol('react-class-model:initializationComplete');
export const initializersSymbol = Symbol('react-class-model:initializers');

type PersistableCtor = Function & {
    [persistenceSymbol]?: Persistence;
    [initializationCompleteSymbol]?: boolean;
    [Symbol.metadata]?: DecoratorMetadataObject;
};

type PersistenceMetadata = DecoratorMetadataObject & {
    [initializersSymbol]?: ((ctor: Function) => void)[];
};

export function getPersistence(ctor: Function | null | undefined, create: boolean = false) {
    if (!ctor) {
        return null;
    }

    const persistableCtor = ctor as PersistableCtor;

    if (!persistableCtor[initializationCompleteSymbol]) {
        persistableCtor[initializationCompleteSymbol] = true;
        runMetadataInitializers(ctor);
    }

    let value = persistableCtor[persistenceSymbol] ?? null;
    if (value) {
        return value;
    }

    if (!create) {
        return null;
    }

    value = new Persistence();
    persistableCtor[persistenceSymbol] = value;
    return value;
}

function runMetadataInitializers(ctor: Function, current: Function = ctor) {
    const parent = Object.getPrototypeOf(current);
    if (typeof parent === 'function') {
        runMetadataInitializers(ctor, parent);
    }

    if (!Object.prototype.hasOwnProperty.call(current, Symbol.metadata)) {
        return;
    }

    const metadata = (current as PersistableCtor)[Symbol.metadata] as PersistenceMetadata | undefined;
    if (typeof metadata !== 'object' || !metadata || !Object.prototype.hasOwnProperty.call(metadata, initializersSymbol)) {
        return;
    }

    const initializers = metadata[initializersSymbol];
    if (!Array.isArray(initializers) || initializers.length === 0) {
        return;
    }

    for (const init of initializers) {
        init(ctor);
    }
}
