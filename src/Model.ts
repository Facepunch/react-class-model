import {
    Context,
    createContext,
    useContext,
    useReducer,
    ProviderExoticComponent,
    ProviderProps,
    useEffect,
    useMemo
} from 'react';
import { Constructor } from './Persistence/CommonTypes';

const proxiedValue = 'proxiedValue';
type ListenerCallback = (version: number) => void;
type Listener = [ListenerCallback, Set<string | symbol> | null];
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
    private flushScheduled: boolean = false;
    private listeners: Listener[] = [];
    private rawReceiverProps = new Set<string | symbol>();
    private dirtyProps: Set<string | symbol> = new Set();
    private props: Map<string | symbol, any> = new Map();

    public get hasListeners() {
        return this.listeners.length > 0;
    }

    public notifyListeners(...propNames: (string | symbol)[]) {
        const names = propNames.length > 0 ? propNames : ['*'];
        for (const name of names) {
            this.dirtyProps.add(name);
        }

        // Always increment version (monotonically) so it is possible to check for external changes
        this.version++;

        if (this.flushScheduled) {
            return;
        }

        this.flushScheduled = true;
        enqueue(() => {
            this.flushScheduled = false;

            // Swap rather than clear, so changes made by a listener get their own flush instead of being cleared out from under the next one
            const dirty = this.dirtyProps;
            this.dirtyProps = new Set();

            const version = this.version;

            // Snapshot: removeListener reassigns this.listeners mid-iteration.
            for (const [callback, props] of this.listeners.slice()) {
                const isRelevant = props instanceof Set
                    ? dirty.has('*') || hasOverlap(dirty, props)
                    : true;

                if (!isRelevant) {
                    continue;
                }

                try {
                    callback(version);
                } catch (e) {
                    this.handleError(e);
                }
            }
        });
    }

    public addListener(listener: ListenerCallback, props?: Set<string | symbol>) {
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

    /** @internal */
    public markAsRawReceiverProp(prop: string | symbol) {
        this.rawReceiverProps.add(prop);
    }

    /** @internal */
    public isRawReceiverProp(prop: string | symbol) {
        return this.rawReceiverProps.has(prop);
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
export function watch<TThis extends Model>(target: ClassAccessorDecoratorTarget<TThis, any>, context: ClassAccessorDecoratorContext<TThis>) {
    const name = context.name;
    const result: ClassAccessorDecoratorResult<TThis, any> = {
        init: function(initialValue: any) {
            this['props'].set(name, initialValue);
        },
        get: function(this: TThis) {
            return this['props'].get(name);
        },
        set: function(this: TThis, newValue: any) {
            const value = this['props'].get(name);
            if (newValue !== value) {
                this['props'].set(name, newValue);
                this.notifyListeners(name);
            }
        },
    };

    return result;
}

/**
 * Define a Model type, assigns it a React Context archetype, and builds hooks to interact with it.
 * @returns The context provider component, a hook to get the model instance from a provider, and a hook to watch for changes on an instance of the model.
 */
export function defineModel<T extends Model>(ctor?: Constructor<T>): DefineResult<T> {
    const context = createContext<T>(null as unknown as T);
    context.displayName = ctor?.name;

    function useModel(trackChanges: true | undefined): ProxiedValue<T>;
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
    const [, forceRender] = useReducer((c: number) => c + 1, 0);
    const modelListeners = useMemo(() => models.map(createListener), models);

    const validModels = modelListeners.filter(t => t[0] instanceof Model);
    const renderVersions = validModels.map(([model]) => (model as Model)['version']);

    useEffect(() => {
        for (const [model, , props] of validModels) {
            (model as Model).addListener(forceRender, props);
        }

        // addListener runs on commit, so anything that changed between render and now was
        // dispatched to zero listeners. Reconcile by re-rendering if we missed a version.
        const missed = validModels.some(([model], i) => (model as Model)['version'] !== renderVersions[i]);
        if (missed) {
            forceRender();
        }

        return () => {
            for (const [model] of validModels) {
                (model as Model).removeListener(forceRender);
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

function createListener<T extends Model | null | undefined>(model: T): [T, ProxiedValue<T>, Set<string | symbol>] {
    const props = new Set<string | symbol>();
    const handler: ProxyHandler<T & Model> = {
        get(target, prop, receiver) {
            if (typeof prop === 'string') {
                if (prop === proxiedValue) {
                    return model;
                }

                if (prop !== 'props' && prop !== 'version' && prop !== 'listeners' && prop !== 'dirtyProps') {
                    props.add(prop);
                }
            }

            if (target.isRawReceiverProp(prop)) {
                return Reflect.get(target, prop, target);
            }
            
            try {
                return Reflect.get(target, prop, receiver);
            } catch (e) {
                // Getters/accessors that read private fields can't run on the proxy.
                // They don't expose watched state through the proxy anyway, so reading
                // them with this = target loses nothing for change tracking.
                if (e instanceof TypeError) {
                    target.markAsRawReceiverProp(prop);
                    return Reflect.get(target, prop, target);
                }
                throw e;
            }
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
        const batch = taskQueue.splice(0, taskQueue.length);
        for (const task of batch) {
            task();
        }
    }
}

function getScheduler(): (fn: () => any) => void {
    // React Native (and Node) expose setImmediate, which runs right after the current
    // execution completes with no timer clamping. Preferred where it genuinely exists.
    const globalSetImmediate = (globalThis as any).setImmediate as ((fn: () => any) => void) | undefined;
    if (typeof globalSetImmediate === 'function') {
        return fn => globalSetImmediate(fn);
    }

    // Browsers: MessageChannel is the same mechanism React's own scheduler uses, so
    // notifications land in the same task class as passive effects instead of being
    // pushed behind setTimeout's 4ms clamp.
    if (typeof MessageChannel === 'function') {
        const channel = new MessageChannel();
        const pending: (() => any)[] = [];

        channel.port1.onmessage = () => {
            // Shift one per message so the 1:1 pairing with postMessage holds even if
            // a callback schedules more work while draining.
            pending.shift()?.();
        };

        return fn => {
            pending.push(fn);
            channel.port2.postMessage(null);
        };
    }

    return fn => setTimeout(fn, 0);
}
