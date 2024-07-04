# react-class-model [![npm version](https://badge.fury.io/js/react-class-model.svg)](https://www.npmjs.com/package/react-class-model)
State management for React with hooks, inspired by Flutter's `scoped_model`.

## Example

Defining models is done by creating a class which extends `Model`. The `@watch` decorators provide automatic model updates when fields are changed.

```ts
import { Model, watch, defineModel } from 'react-class-model';

export class CounterModel extends Model {
    @watch
    public value: number = 0;

    public reset() {
        this.value = 0;
    }
}

export const [CounterModelProvider, useCounterModel] = defineModel(CounterModel);
```

The provider component uses [React Context](https://react.dev/learn/passing-data-deeply-with-context) to make the model available to the `use` hooks in the React tree. The components using the model will automatically re-render when any of the referenced, `@watch`ed fields are changed.

```tsx
import { useState } from 'react';
import { CounterModel, CounterModelProvider, useCounterModel } from './models/CounterModel.ts';

function RootComponent() {
    const [counterModel] = useState(() => new CounterModel());

    return (
        <CounterModelProvider value={counterModel}>
            <CounterDisplay />
            <CounterControls />
        </CounterModelProvider>
    );
};

function CounterDisplay() {
    const { value } = useCounterModel();
    return <Text>{value}</Text>;
}

function CounterControls() {
    const counter = useCounterModel();
    return (
        <View>
            <Button title='+' onPress={() => counter.value++} />
            <Button title='Reset' onPress={() => counter.reset()} />
        </View>
    );
}
```
