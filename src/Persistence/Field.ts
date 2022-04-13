import { Constructor, DeserializeResult, Getter, Setter } from './CommonTypes';
import { getPersistence, throwPersistenceRequired } from './Persistence';
import { deserializeCopy } from './Serialization';

export class Field {
    public ctor: Constructor<any>;
    public transient: boolean;
    public copy: boolean;
    public get: Getter<any>;
    public set: Setter<any>;

    constructor(ctor: Constructor<any>, transient: boolean, copy: boolean, get: Getter<any>, set: Setter<any>) {
        this.ctor = ctor;
        this.transient = transient;
        this.copy = copy;
        this.get = get;
        this.set = set;
    } 

    public deserialize(props: any, current: any): DeserializeResult {
        if (props === undefined || props === null || !this.ctor) {
            return [props !== current, props];
        }

        const persistence = getPersistence(this.ctor);
        if (!persistence) {
            throwPersistenceRequired(this.ctor);
            return; // not reachable
        }

        if (current && persistence.deserializeInto) {
            const changed = persistence.deserializeInto(props, current);
            return [changed, current];
        }

        if (persistence.deserialize) {
            return persistence.deserialize(props);
        }

        const value = current ?? new this.ctor();
        const changed = deserializeCopy(persistence, value, props);
        return [changed, value];
    }
}
