import { key, prop } from '.';
import { Model, watch } from '../Model';

export function expectModelToStrictEqual<T extends Model>(actual: T, expected: T) {
    expect(actual['props']).toStrictEqual(expected['props']);
}

export class Point {
    @prop()
    accessor x: number | undefined;

    @prop()
    accessor y: number | undefined;

    public z: number | undefined;

    constructor(x?: number, y?: number, z?: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

export class Line {
    @prop({ ctor: Point })
    accessor start: Point;

    @prop({ ctor: Point })
    accessor end: Point;
}

export class NumberList {
    @prop()
    accessor values: number[];
}

export class PointList {
    @prop({ ctor: Point })
    accessor values: Point[];
}

export class Player {
    @prop() @key
    accessor id: number | undefined;

    @prop()
    accessor name: string | undefined;

    constructor(id?: number, name?: string) {
        this.id = id;
        this.name = name;
    }
}

export class Team {
    @prop({ ctor: Player })
    accessor members: Player[];
}

export class PlayerModel extends Model {
    @prop() @watch @key
    accessor id: number | undefined;

    @prop() @watch
    accessor name: string | undefined;

    constructor(id?: number, name?: string) {
        super();
        this.id = id;
        this.name = name;
    }
}

export class TeamModel extends Model {
    @prop({ ctor: PlayerModel }) @watch
    accessor members: PlayerModel[];
}

export class Variable extends Model {
    @prop() @watch
    accessor type: string;

    @prop() @watch
    accessor value: string;
}

export class VariableSet extends Model {
    @prop({ ctor: { value: Variable } }) @watch
    accessor data: Map<string, Variable> = new Map();
}
