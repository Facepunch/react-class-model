import { requirePersistence } from '../Persistence';
import { deserializeCopy, toSerializable } from '../Serialization';
import { Line, NumberList, Player, Point, PointList, Team } from '../TestClasses';

describe('#toSerializable', () => {
    describe('primitives', () => {
        it('returns undefined as is', () => {
            expect(toSerializable(undefined)).toBeUndefined();
        });

        it('returns null as is', () => {
            expect(toSerializable(null)).toBeNull();
        });

        it('returns strings as is', () => {
            expect(toSerializable('test')).toBe('test');
            expect(toSerializable('abc')).toBe('abc');
        });

        it('returns numbers as is', () => {
            expect(toSerializable(1)).toBe(1);
            expect(toSerializable(10)).toBe(10);
        });

        it('returns booleans as is', () => {
            expect(toSerializable(true)).toBe(true);
            expect(toSerializable(false)).toBe(false);
        });

        it('throws when trying to serialize a function', () => {
            expect(() => toSerializable(toSerializable)).toThrow(/function/);
        });

        it('throws when trying to serialize a symbol', () => {
            expect(() => toSerializable(Symbol.for('foo'))).toThrow(/symbol/);
        });
    });
});

describe('#deserializeCopy', () => {
    const pointPersistence = requirePersistence(Point);
    const linePersistence = requirePersistence(Line);
    const numberListPersistence = requirePersistence(NumberList);
    const pointListPersistence = requirePersistence(PointList);
    const teamPersistence = requirePersistence(Team);

    describe('primitives', () => {
        it('clears primitive fields to undefined', () => {
            const point = new Point(10);
            const changed = deserializeCopy(pointPersistence, point, { x: undefined });
            expect(changed).toBe(true);
            expect(point.x).toBeUndefined();
            expect(point.y).toBeUndefined();
        });

        it('clears primitive fields to null', () => {
            const point = new Point(10);
            const changed = deserializeCopy(pointPersistence, point, { x: null });
            expect(changed).toBe(true);
            expect(point.x).toBeNull();
            expect(point.y).toBeUndefined();
        });

        it('does not clear primitive fields when missing', () => {
            const point = new Point(10);
            const changed = deserializeCopy(pointPersistence, point, {});
            expect(changed).toBe(false);
            expect(point.x).toBe(10);
            expect(point.y).toBeUndefined();
        });

        it('sets primitive fields', () => {
            const point = new Point();
            expect(point.x).toBeUndefined();
            const changed = deserializeCopy(pointPersistence, point, { x: 1 });
            expect(changed).toBe(true);
            expect(point.x).toBe(1);
            expect(point.y).toBeUndefined();
        });

        it('returns false if primitive fields are unchanged', () => {
            const point = new Point(1);
            const changed = deserializeCopy(pointPersistence, point, { x: 1 });
            expect(changed).toBe(false);
            expect(point.x).toBe(1);
            expect(point.y).toBeUndefined();
        });
    });

    describe('objects', () => {
        it('clears objects for undefined fields', () => {
            const line = new Line();
            line.start = new Point();
            expect(line.start).toBeDefined();
            const changed = deserializeCopy(linePersistence, line, { start: undefined });
            expect(changed).toBe(true);
            expect(line.start).toBeUndefined();
        });
    
        it('clears objects for null fields', () => {
            const line = new Line();
            line.start = new Point();
            expect(line.start).toBeDefined();
            const changed = deserializeCopy(linePersistence, line, { start: null });
            expect(changed).toBe(true);
            expect(line.start).toBeNull();
        });
    
        it('populates object fields', () => {
            const line = new Line();
            expect(line.start).toBeUndefined();
            const changed = deserializeCopy(linePersistence, line, { start: { x: 1 } });
            expect(changed).toBe(true);
            expect(line.start).toBeDefined();
            expect(line.start).toBeInstanceOf(Point);
            expect(line.start.x).toBe(1);
            expect(line.start.y).toBeUndefined();
        });
    
        it('sets fields within populated object fields', () => {
            const line = new Line();
            line.start = new Point();
            expect(line.start.x).toBeUndefined();
            const changed = deserializeCopy(linePersistence, line, { start: { x: 1 } });
            expect(changed).toBe(true);
            expect(line.start.x).toBe(1);
        });
    
        it('returns false if object fields are unchanged', () => {
            const line = new Line();
            line.start = new Point(1);
            const changed = deserializeCopy(linePersistence, line, { start: { x: 1 } });
            expect(changed).toBe(false);
            expect(line.start.x).toBe(1);
        });
    });
    
    describe('arrays', () => {
        it('sets array of primitives with no transformation', () => {
            const numberList = new NumberList();
            const values = [1, 2, 3];
            expect(numberList.values).toBeUndefined();
            const changed = deserializeCopy(numberListPersistence, numberList, { values });
            expect(changed).toBe(true);
            expect(numberList.values).toBe(values);
        });
    
        it('populates objects in array fields', () => {
            const pointList = new PointList();
            const values = [new Point(1, 1), new Point(2, 2)];
            expect(pointList.values).toBeUndefined();
            const changed = deserializeCopy(pointListPersistence, pointList, { values });
            expect(changed).toBe(true);
            expect(pointList.values).not.toBe(values);
            expect(pointList.values).toEqual(values);
        });
    
        it('updates objects in array fields', () => {
            const pointList = new PointList();
            pointList.values = [new Point(1, 1), new Point(2, 2)];
            const values = [new Point(10, 10), new Point(20, 20), new Point(30, 30)];
            const changed = deserializeCopy(pointListPersistence, pointList, { values });
            expect(changed).toBe(true);
            expect(pointList.values).not.toBe(values);
            expect(pointList.values).toEqual(values);
        });
    });

    describe('array merging', () => {
        const player1 = new Player(1, 'One');
        const player2 = new Player(2, 'Two');
        const player3 = new Player(3, 'Three');

        it('populated objects in keyed array fields', () => {
            const team = new Team();
            expect(team.members).toBeUndefined();
            const changed = deserializeCopy(teamPersistence, team, { members: [player1, player2, player3] });
            expect(changed).toBe(true);
            expect(team.members).toHaveLength(3);
            expect(team.members[0]).toEqual(player1);
            expect(team.members[1]).toEqual(player2);
            expect(team.members[2]).toEqual(player3);
        });

        it('updates objects in keyed array fields', () => {
            const team = new Team();
            team.members = [player1, player2, player3];
            const changed = deserializeCopy(teamPersistence, team, { members: [{ id: 1, name: 'Player A' }, player2, player3] });
            expect(changed).toBe(true);
            expect(team.members[0].name).toBe('Player A');
        });

        it('adds new objects to keyed array fields', () => {
            const team = new Team();
            team.members = [player2];
            const changed = deserializeCopy(teamPersistence, team, { members: [player1, player2, player3] });
            expect(changed).toBe(true);
            expect(team.members).toHaveLength(3);
            expect(team.members[0]).toEqual(player1);
            expect(team.members[1]).toEqual(player2);
            expect(team.members[2]).toEqual(player3);
        });

        it('removes old objects from keyed array fields', () => {
            const team = new Team();
            team.members = [player1, player2, player3];
            const changed = deserializeCopy(teamPersistence, team, { members: [player3] });
            expect(changed).toBe(true);
            expect(team.members).toHaveLength(1);
            expect(team.members[0]).toEqual(player3);
        });

        it('reorders objects in keyed array fields', () => {
            const team = new Team();
            team.members = [player1, player2, player3];
            const changed = deserializeCopy(teamPersistence, team, { members: [player3, player1, player2] });
            expect(changed).toBe(true);
            expect(team.members).toHaveLength(3);
            expect(team.members[0]).toBe(player3);
            expect(team.members[1]).toBe(player1);
            expect(team.members[2]).toBe(player2);
        });

        it('reorders and updates objects in keyed array fields', () => {
            const team = new Team();
            team.members = [player1, player2, player3];
            const changed = deserializeCopy(teamPersistence, team, { members: [{ id: 3, name: '3' }, { id: 1, name: '1' }, { id: 2, name: '2' }] });
            expect(changed).toBe(true);
            expect(team.members).toHaveLength(3);
            expect(team.members[0]).toMatchObject({ id: 3, name: '3' });
            expect(team.members[1]).toMatchObject({ id: 1, name: '1' });
            expect(team.members[2]).toMatchObject({ id: 2, name: '2' });
        });

        it('returns false if objects in keyed array field are unchanged', () => {
            const team = new Team();
            team.members = [player1, player2, player3];
            const changed = deserializeCopy(teamPersistence, team, { members: [player1, player2, player3] });
            expect(changed).toBe(false);
            expect(team.members).toHaveLength(3);
            expect(team.members[0]).toBe(player1);
            expect(team.members[1]).toBe(player2);
            expect(team.members[2]).toBe(player3);
        });
    });
});
