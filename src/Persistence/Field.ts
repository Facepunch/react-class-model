import { Constructor, Getter, Setter } from './CommonTypes';
import { getPersistence, throwPersistenceRequired } from './Persistence';

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

    public construct(props: any) {
        if (!this.ctor) {
            return props;
        }

        const persistence = getPersistence(this.ctor);
        if (persistence && persistence.binder) {
            return new this.ctor(...persistence.binder(props));
        } else if (typeof props === 'object') {
            if (!persistence) {
                throwPersistenceRequired(this.ctor);
                return;
            }
            
            return new this.ctor(...persistence.keys.map(key => props[key]));
        } else {
            return new this.ctor(props);
        }
    }
}
