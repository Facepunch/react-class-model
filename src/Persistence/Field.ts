import { DeserializeResult, Getter, PropConstructor, Setter } from './CommonTypes';
import { requirePersistence } from './Persistence';
import { deserializeCopy } from './Serialization';

export class Field {
    public ctor: PropConstructor<any> | undefined;
    public transient: boolean;
    public copy: boolean;
    public get: Getter<any>;
    public set: Setter<any>;

    constructor(ctor: PropConstructor<any> | undefined, transient: boolean, copy: boolean, get: Getter<any>, set: Setter<any>) {
        this.ctor = ctor;
        this.transient = transient;
        this.copy = copy;
        this.get = get;
        this.set = set;
    } 

    public deserialize(props: any, current: any): DeserializeResult {
        const ctor = typeof this.ctor === 'object' ? this.ctor.value : this.ctor;
        if (props === undefined || props === null || !ctor) {
            return [props !== current, props];
        }

        // if this field is a Map<string,V> we need to deserialize into then Field.deserialize is only called for the values in the map
        const persistence = requirePersistence(ctor);

        if (current && persistence.deserializeInto) {
            const changed = persistence.deserializeInto(props, current);
            return [changed, current];
        }

        if (persistence.deserialize) {
            return [true, persistence.deserialize(props)];
        }

        const value = current ?? new ctor();
        const changed = deserializeCopy(persistence, value, props);
        return [changed, value];
    }
}
