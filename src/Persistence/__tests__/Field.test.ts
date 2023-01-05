import { setupSerialization } from '..';
import { Field } from '../Field';

describe('Field', () => {
    describe('#deserialize', () => {
        it('handles undefined', () => {
            const field = new Field(undefined, false, false, () => '', x => {});
            expect(field.deserialize(undefined, 1)).toStrictEqual([true, undefined]);
            expect(field.deserialize(undefined, undefined)).toStrictEqual([false, undefined]);
        });

        it('handles null', () => {
            const field = new Field(undefined, false, false, () => '', x => {});
            expect(field.deserialize(null, 1)).toStrictEqual([true, null]);
            expect(field.deserialize(null, null)).toStrictEqual([false, null]);
        });

        it('throws if the constructor has no persistence instance', () => {
            class Test {}
            const field = new Field(Test, false, false, () => '', x => {});
            expect(() => field.deserialize({}, {})).toThrow(/no persistence defined/);
        });

        it('uses the custom deserializer when available', () => {
            class Test {
                constructor (public readonly value: number) {}
            }

            setupSerialization(Test, {
                serialize: instance => instance.value,
                deserialize: value => new Test(value),
            });

            const field = new Field(Test, false, false, () => '', x => {});
            expect(field.deserialize(123, undefined)).toStrictEqual([true, new Test(123)]);
        });

        it('uses the custom in-place deserializer when available', () => {
            class Test {
                constructor (public value: number) {}
            }

            setupSerialization(Test, {
                serialize: instance => instance.value,
                deserialize: value => new Test(value),
                deserializeInto: (value, instance) => {
                    const changed = instance.value !== value;
                    instance.value = value;
                    return changed;
                },
            });

            const field = new Field(Test, false, false, () => '', x => {});

            const valueA = new Test(123);
            const [aChanged, aNew] = field.deserialize(456, valueA);
            expect(aChanged).toBe(true);
            expect(aNew).toBe(valueA);
            expect(aNew.value).toBe(456);

            const valueB = new Test(456);
            const [bChanged, bNew] = field.deserialize(456, valueB);
            expect(bChanged).toBe(false);
            expect(bNew).toBe(valueB);
            expect(bNew.value).toBe(456);
        });
    });
});
