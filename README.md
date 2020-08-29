# react-class-model [![npm version](https://badge.fury.io/js/react-class-model.svg)](https://www.npmjs.com/package/react-class-model)
State management for React with hooks, inspired by Flutter's scoped_model

## Example

Defining models is done by creating a class which extends `Model`. Decorators are optional but useful to provide automatic model updates and (de)serialization functionality.

```ts
import {
    Model,
    watch,
    prop,
    key,
    deserializeInto,
} from 'react-class-model';

export class TeamMember extends Model {
    @watch @prop() @key
    public username: string;

    @watch @prop()
    public avatarUrl: string;
}

export class Team extends Model {
    @watch @prop()
    public name: string;

    @watch @prop({ ctor: TeamMember })
    public members: TeamMember[];

    constructor() {
        super();
        this.name = 'Unknown';
        this.members = [];
    }

    public rename(newName: string) {
        if (!newName) {
            throw new Error('Team names cannot be empty!');
        }

        this.name = newName;

        // If the name field didn't have the @watch decorator we can manually
        // notify that the model changed:

        // this.notifyListeners();
    }

    public updateFromJson(json: string) {
        // Copies fields from JSON based on the @prop decorator
        // Useful when receiving new data from an API
        // The @key decorator will be used to preserve instances when updating
        deserializeInto(this, json);
    }
}

// Generates the provider component and hook to use the model
export const [ TeamProvider, useTeam ] = defineModel<Team>();
```

The provider component uses [React Context](https://reactjs.org/docs/context.html) to make the model available to hooks in the React tree.

```tsx
import { useState } from 'react';

function RootComponent() {
    const [team, setTeam] = useState(() => new Team());

    return (
        <TeamProvider value={team}>
            <TeamComponent />
        </TeamProvider>
    );
};

function TeamComponent() {
    const team = useTeam();

    // The team variable will have a reference to the Team class
    // Can render out the team here now
    // It will automatically re-render when the model is changed
}
```
