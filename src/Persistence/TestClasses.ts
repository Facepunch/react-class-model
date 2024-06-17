import { key, prop } from '.';
import { Model, watch } from '../Model';

export function expectModelToStrictEqual<T extends Model>(actual: T, expected: T) {
    expect(actual['props']).toStrictEqual(expected['props']);
}

export class Point {
    @prop()
    public x: number | undefined;

    @prop()
    public y: number | undefined;

    public z: number | undefined;

    constructor(x?: number, y?: number, z?: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

export class Line {
    @prop({ ctor: Point })
    public start: Point;

    @prop({ ctor: Point })
    public end: Point;
}

export class NumberList {
    @prop()
    public values: number[];
}

export class PointList {
    @prop({ ctor: Point })
    public values: Point[];
}

export class Player {
    @prop() @key
    public id: number | undefined;

    @prop()
    public name: string | undefined;

    constructor(id?: number, name?: string) {
        this.id = id;
        this.name = name;
    }
}

export class Team {
    @prop({ ctor: Player })
    public members: Player[];
}

export class PlayerModel extends Model {
    @prop() @watch @key
    public id: number | undefined;

    @prop() @watch
    public name: string | undefined;

    constructor(id?: number, name?: string) {
        super();
        this.id = id;
        this.name = name;
    }
}

export class TeamModel extends Model {
    @prop({ ctor: PlayerModel }) @watch
    public members: PlayerModel[];
}

export class Variable extends Model {
    @prop() @watch
    public type: string;

    @prop() @watch
    public value: string;
}

export class VariableSet extends Model {
    @prop({ ctor: { value: Variable } }) @watch
    public data: Map<string, Variable> = new Map();
}
