# redux-optimist

Optimistically apply actions that can be later commited or reverted.

[![Build Status](https://img.shields.io/travis/ForbesLindesay/redux-optimist/master.svg)](https://travis-ci.org/ForbesLindesay/redux-optimist)
[![Dependency Status](https://img.shields.io/gemnasium/ForbesLindesay/redux-optimist.svg)](https://gemnasium.com/ForbesLindesay/redux-optimist)
[![NPM version](https://img.shields.io/npm/v/redux-optimist.svg)](https://www.npmjs.org/package/redux-optimist)

## Installation

    npm install redux-optimist

## Usage

### Step 1: Wrap your top level reducer in redux-optimist

#### `reducers/todos.js`

```js
export default function todos(state = [], action) {
  switch (action.type) {
  case 'ADD_TODO':
    return state.concat([action.text]);
  default:
    return state;
  }
}
```

#### `reducers/status.js`

```js
export default function status(state = {writing: false, error: null}, action) {
  switch (action.type) {
  case 'ADD_TODO':
    return {writing: true, error: null};
  case 'ADD_TODO_COMPLETE':
    return {writing: false, error: null};
  case 'ADD_TODO_FAILED':
    return {writing: false, error: action.error};
  default:
    return state;
  }
}
```

#### `reducers/index.js`

```js
import optimist from 'redux-optimist';
import { combineReducers } from 'redux';
import todos from './todos';
import status from './status';

export default optimist(combineReducers({
  todos,
  status
}));
```

As long as your top-level reducer returns a plain object, you can use optimist.  You don't
have to use `Redux.combineReducers`.

### Step 2: Mark your optimistic actions with the `optimist` key

#### `middleware/api.js`

```js
import {BEGIN, COMMIT, REVERT} from 'optimist';
import request from 'then-request';

let nextTransactionID = 0;
export default function (store) {
  return next => action => {
    if (action.type !== 'ADD_TODO') {
      return next(action);
    }
    let transactionID = nextTransactionID++;
    next({
      type: 'ADD_TODO',
      text: action.text,
      optimist: {type: BEGIN, id: transactionID}
    });
    request('POST', '/add_todo', {text: action.text}).getBody().done(
      res => next({
        type: 'ADD_TODO_COMPLETE',
        text: action.text,
        response: res,
        optimist: {type: COMMIT, id: transactionID}
      }),
      err => next({
        type: 'ADD_TODO_FAILED',
        text: action.text,
        error: err,
        optimist: {type: REVERT, id: transactionID}
      })
    );
  }
};
```

Note how we always follow up by either COMMITing the transaction or REVERTing it.  If you do neither, you will get a memory leak.  Also note that we use a serialisable transactionID such as a number.  These should always
be unique accross the entire system.

### Step 3:

Using this, we can safely fire off `ADD_TODO` actions in the knowledge that the UI will update optimisticly, but will revert if the write to the server fails.

`App.js`

```js
import { createStore, applyMiddleware } from 'redux';
import api from './middleware/api';
import reducer from './reducers';

let store = applyMiddleware(api)(createStore)(reducer);
console.log(store.getState());
// {
//   optimist: {...},
//   todos: [],
//   status: {writing: false, error: null}
// }

store.dispatch({
  type: 'ADD_TODO',
  text: 'Use Redux'
});
console.log(store.getState());
// {
//   optimist: {...},
//   todos: ['Use Redux'],
//   status: {writing: true, error: null}
// }

// You can apply other actions here and their updates won't get lost
// even if the original ADD_TODO action gets reverted.

// Some time later...
console.log(store.getState());
// either
// {
//   optimist: {...},
//   todos: ['Use Redux'],
//   status: {writing: false, error: null}
// }
// or
// {
//   optimist: {...},
//   todos: [],
//   status: {writing: false, error: Error}
// }
```

## License

  MIT
