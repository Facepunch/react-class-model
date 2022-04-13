import { key, prop } from '.';

export class Point {
    @prop()
    public x: number;

    @prop()
    public y: number;

    public z: number;

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
    public id: number;

    @prop()
    public name: string;

    constructor(id?: number, name?: string) {
        this.id = id;
        this.name = name;
    }
}

export class Team {
    @prop({ ctor: Player })
    public members: Player[];
}
