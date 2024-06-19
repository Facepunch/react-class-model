import {
    Context,
    createContext,
    useContext,
    useState,
    ProviderExoticComponent,
    ProviderProps,
    useEffect,
    useMemo
} from 'react';
import { Constructor } from './Persistence/CommonTypes';

const proxiedValue = 'proxiedValue';
type ListenerCallback = (version: number) => void;
type Listener = [ListenerCallback, Set<string> | null];
type ProxiedValue<T extends Model | null | undefined> = T extends Model ? T & { [proxiedValue]: T } : T;
type UseModelFn<T extends Model> = {
    (trackChanges?: true): ProxiedValue<T>;
    (trackChanges: false): T;
};
type WatchModelFn<T extends Model> = {
    (model: T): ProxiedValue<T>;
    (model: T | null): ProxiedValue<T> | null;
    (model: T | undefined): ProxiedValue<T> | undefined;
    (model: T | null | undefined): ProxiedValue<T> | null | undefined;
    (...models: T[]): ProxiedValue<T>[];
    (...models: (T | null)[]): (ProxiedValue<T> | null)[];
    (...models: (T | undefined)[]): (ProxiedValue<T> | undefined)[];
    (...models: (T | null | undefined)[]): (ProxiedValue<T> | null | undefined)[];
};
type DefineResult<T extends Model> = [
    ProviderExoticComponent<ProviderProps<T>>,
    UseModelFn<T>,
    WatchModelFn<T>,
    Context<T>
];

/**
 * Base class for your models. Derive from this and call {@link Model.notifyListeners()} when you change data to notify consumers.
 * @see The {@link watch()} field decorator automatically calls {@link Model.notifyListeners()} when the field it is applied to are updated.
 */
export abstract class Model {
    private version: number = 1;
    private listeners: Listener[] = [];
    private dirtyProps: Set<string> = new Set();
    private props: Map<string | symbol, any> = new Map();

    public get hasListeners() {
        return this.listeners.length > 0;
    }

    public notifyListeners(...propNames: string[]) {
        if (Array.isArray(propNames) && propNames.length > 0) {
            if (!propNames.some(p => addToSet(this.dirtyProps, p))) {
                return;
            }
        } else if (!addToSet(this.dirtyProps, '*')) {
            return;
        }
        
        this.version++;
        if (this.version > 100000) {
            this.version = 1;
        }
        
        enqueue(() => {
            for (let i = 0; i < this.listeners.length; i++) {
                const [callback, props] = this.listeners[i];
                const isRelevant = props instanceof Set
                    ? this.dirtyProps.has('*') || hasOverlap(this.dirtyProps, props)
                    : true;

                if (!isRelevant) {
                    continue;
                }

                try {
                    callback(this.version);
                } catch (e) {
                    this.handleError(e);
                }
            }

            this.dirtyProps.clear();
        });
    }

    public addListener(listener: ListenerCallback, props?: Set<string>) {
        this.listeners.push([listener, props ?? null]);

        if (this.listeners.length > 100) {
            this.handleError(new Error(`Too many listeners on ${this.constructor.name}`));
        }
    }

    public removeListener(listener: ListenerCallback) {
        this.listeners = this.listeners.filter(t => t[0] !== listener);
    }

    protected handleError(e: any) {
        console.error(e);
    }
}

function addToSet<T>(set: Set<T>, value: T): boolean {
    if (set.has(value)) {
        return false;
    } else {
        set.add(value);
        return true;
    }
}

function hasOverlap<T>(setA: Set<T>, setB: Set<T>): boolean {
    for (const v of setA) {
        if (setB.has(v)) {
            return true;
        }
    }

    return false;
}

/**
 * Field decorator which injects calls to {@link Model.notifyListeners()} automatically when the field value is changed.
 */
export function watch<T extends Model>(target: T, propertyKey: string | symbol, prevDesc?: any): any {
    let initializer = prevDesc && prevDesc.initializer;
    const getValue = (instance: any) => {
        if (initializer && !instance.props.has(propertyKey)) {
            const value = initializer();
            instance.props.set(propertyKey, value);
            return value;
        }

        return instance.props.get(propertyKey);
    };

    const descriptor: PropertyDescriptor = {
        get() {
            return getValue(this);
        },

        set(newValue: any) {
            const value = getValue(this);
            if (newValue !== value) {
                this.props.set(propertyKey, newValue);
                this.notifyListeners(propertyKey);
            }
        },

        enumerable: true,
    };

    delete target[propertyKey];
    Object.defineProperty(target, propertyKey, descriptor);
    return descriptor;
}

/**
 * Define a Model type, assigns it a React Context archetype, and builds hooks to interact with it.
 * @returns The context provider component, a hook to get the model instance from a provider, and a hook to watch for changes on an instance of the model.
 */
export function defineModel<T extends Model>(ctor?: Constructor<T>): DefineResult<T> {
    const context = createContext<T>(null as unknown as T);
    context.displayName = ctor?.name;

    function useModel(trackChanges: true): ProxiedValue<T>;
    function useModel(trackChanges: false): T;
    function useModel(trackChanges: boolean = true) {
        const value = useContext<T>(context);
        if (!value) {
            throw new Error(`useModel: No provider found for model ${context?.displayName ?? '<unknown>'}`);
        }
    
        if (trackChanges) {
            return watchModel(value);
        } else {
            return value;
        }
    }

    return [
        context.Provider,
        useModel,
        watchModel,
        context
    ];
}


function watchModel<T extends Model | null | undefined>(moddel: T) : ProxiedValue<T>;
function watchModel<T extends Model | null | undefined>(...models: T[]): ProxiedValue<T> | ProxiedValue<T>[] {   
    const [, setState] = useState(0);
    const modelListeners = useMemo(() => models.map(createListener), models)

    useEffect(() => {
        const validModels = modelListeners.filter(t => t[0] instanceof Model);
        for (const [model, , props] of validModels) {
            model?.addListener(setState, props);
        }

        return () => {
            for (const [model] of validModels) {
                model?.removeListener(setState);
            }
        }
    }, modelListeners);

    // reset the touched props because the component should be re-rendering now and will touch them again
    for (const [, , props] of modelListeners) {
        props.clear();
    }

    return models.length === 1
        ? modelListeners[0][1]
        : modelListeners.map(t => t[1]);
}

function createListener<T extends Model | null | undefined>(model: T): [T, ProxiedValue<T>, Set<string>] {
    const props = new Set<string>();
    const handler: ProxyHandler<T & Model> = {
        get(target, prop) {
            if (typeof prop === 'string') {
                if (prop === proxiedValue) {
                    return model;
                }

                props.add(prop);
            }
            
            return target[prop];
        }
    };

    const proxy = model instanceof Model
        ? new Proxy(model, handler)
        : model;

    return [model, proxy as ProxiedValue<T>, props];
}

const scheduler = getScheduler();
const taskQueue: (() => void)[] = [];

function enqueue(task: () => void) {
    if (taskQueue.length === 0) {
        scheduler(flushTasks);
    }

    taskQueue.push(task);
}

function flushTasks() {
    while (taskQueue.length > 0) {
        const task = taskQueue.pop();
        task?.();
    }
}

function getScheduler(): (fn: () => any) => void {
    if (typeof window === 'object' && typeof window['setImmediate'] === 'function') {
        return window['setImmediate'];
    }

    // TODO: good fallbacks
    return fn => setTimeout(fn, 0);
}
