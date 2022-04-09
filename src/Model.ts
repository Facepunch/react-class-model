import {
    Context,
    createContext,
    useContext,
    useState,
    ProviderExoticComponent,
    ProviderProps,
    useEffect
} from 'react';

type Listener = (version: number) => void;
type UseModelFn<T extends Model> = (trackChanges?: boolean) => T;
type WatchModelFn<T extends Model> = (model: T) => T;
type DefineResult<T extends Model> = [
    ProviderExoticComponent<ProviderProps<T>>,
    UseModelFn<T>,
    WatchModelFn<T>,
    Context<T>
];

/**
 * Base class for your models. Derive from this and call {@link notifyListeners()} when you change data to notify consumers.
 * @see {@link watch} for a field decorator which automatically calls {@link notifyListeners()} when specific fields are updated.
 */
export abstract class Model {
    private version: number = 1;
    private listeners: Listener[] = [];
    private dirty: boolean = false;
    private props: Map<string | symbol, any> = new Map();

    public get hasListeners() {
        return this.listeners.length > 0;
    }

    public notifyListeners() {
        if (this.dirty) {
            return;
        }

        this.dirty = true;
        this.version++;
        if (this.version > 100000) {
            this.version = 1;
        }
        
        enqueue(() => {
            this.dirty = false;

            for (let i = 0; i < this.listeners.length; i++) {
                try {
                    this.listeners[i](this.version);
                } catch (e) {
                    this.handleError(e);
                }
            }
        });
    }

    public addListener(listener: Listener) {
        this.listeners.push(listener);

        if (this.listeners.length > 100) {
            this.handleError(new Error(`Too many listeners on ${this.constructor.name}`));
        }
    }

    public removeListener(listener: Listener) {
        this.listeners = this.listeners.filter(i => i !== listener);
    }

    protected handleError(e: any) {
        console.error(e);
    }
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

    const descriptor = {
        get() {
            return getValue(this);
        },

        set(newValue: any) {
            const value = getValue(this);
            if (newValue !== value) {
                this.props.set(propertyKey, newValue);
                this.notifyListeners();
            }
        },
    };

    delete target[propertyKey];
    Object.defineProperty(target, propertyKey, descriptor);
    return descriptor;
}

/**
 * Define a Model type, assigns it a React Context archetype, and builds hooks to interact with it.
 * @returns The context provider component, a hook to get the model instance from a provider, and a hook to watch for changes on an instance of the model.
 */
export function defineModel<T extends Model>(): DefineResult<T> {
    const context = createContext<T>(null);
    
    return [
        context.Provider,
        (trackChanges: boolean = true) => useModel<T>(context, trackChanges),
        (model: T) => watchModel<T>(model),
        context
    ];
}

function useModel<T extends Model>(context: Context<T>, trackChanges: boolean) {
    const value = useContext<T>(context);
    if (!value) {
        return null;
    }

    if (trackChanges) {
        watchModel(value);
    }

    return value;
}

function watchModel<T extends Model>(value: T) {
    const [, setState] = useState(0);

    useEffect(() => {
        if (value) {
            value.addListener(setState);
            return () => value.removeListener(setState);
        }
    }, [ value ]);

    return value;
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
        task();
    }
}

function getScheduler(): (fn: () => any) => void {
    if (typeof window['setImmediate'] === 'function') {
        return window['setImmediate'];
    }

    // TODO: good fallbacks
    return fn => setTimeout(fn, 0);
}
