'use strict';

import assert from 'assert';
import test from 'testit';
import optimist from '../src';

function getWarnings(fn) {
  var warnings = [];
  var ce = console.error;
  console.error = err => warnings.push(err);
  fn();
  console.error = ce;
  return warnings;
}

test('with a non-object return type it throws', () => {
  try {
    optimist(function () { })(undefined, {type: 'foo'});
  } catch (ex) {
    assert(ex instanceof TypeError);
    assert(ex.message === 'Error while handling "foo": Optimist requires that state is always a plain object.');
    return;
  }
  throw new Error('Optimist should have thrown an exception');
});
test('with an object it mixes in the initial state', () => {
  let action = {type: 'foo'};
  let res = optimist(function (state, a) {
    assert(state === undefined);
    assert(a === action);
    return {lastAction: a};
  })(undefined, action);
  assert.deepEqual(res, {optimist: {}, lastAction: action});
});
test('when you attempt to commit a non-existent transaction it warns', () => {
  let action = {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-transaction'}};
  let res;
  let warnings = getWarnings(() => {
    res = optimist(function (state, a) {
      assert(state === undefined);
      assert(a === action);
      return {lastAction: a};
    })(undefined, action);
  });
  assert.deepEqual(
    warnings,
    ['Cannot COMMIT transaction with id "my-transaction" because it does not exist']
  );
  assert.deepEqual(res, {optimist: {}, lastAction: action});
});
test('when you attempt to revert a non-existent transaction it warns', () => {
  let action = {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-transaction'}};
  let res;
  let warnings = getWarnings(() => {
    res = optimist(function (state, a) {
      assert(state === undefined);
      assert(a === action);
      return {lastAction: a};
    })(undefined, action);
  });
  assert.deepEqual(
    warnings,
    ['Cannot REVERT transaction with id "my-transaction" because it does not exist']
  );
  assert.deepEqual(res, {optimist: {}, lastAction: action});
});

test('beginning a transaction', () => {
  let action = {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}};
  let res = optimist(function (state, a) {
    assert.deepEqual(state, {initial: 'state'});
    assert(a === action);
    return {lastAction: a};
  })({initial: 'state'}, action);
  assert.deepEqual(
    res,
    {
      optimist: {
        'my-transaction': { state: {initial: 'state'}, actions: [] }
      },
      lastAction: action
    }
  );
});

test('within a transaction', () => {
  let action = {type: 'foo'};
  let initialState = {
    optimist: {
      'my-transaction': { state: {initial: 'state'}, actions: [] }
    },
    lastAction: {type: 'bar'}
  };
  let res = optimist(function (state, a) {
    assert.deepEqual(state, {lastAction: {type: 'bar'}});
    assert(a === action);
    return {lastAction: a};
  })(initialState, action);
  assert.deepEqual(
    res,
    {
      optimist: {
        'my-transaction': { state: {initial: 'state'}, actions: [action] }
      },
      lastAction: action
    }
  );
});

test('revert a transaction', () => {
  let action = {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-transaction'}};
  let initialState = {
    optimist: {
      'my-transaction': { state: {initial: 'state'}, actions: [] }
    },
    lastAction: {type: 'bar'}
  };
  let res = optimist(function (state, a) {
    assert.deepEqual(state, {initial: 'state'});
    assert(a === action);
    return {lastAction: a};
  })(initialState, action);
  assert.deepEqual(
    res,
    {
      optimist: {},
      lastAction: action
    }
  );
});

test('revert a transaction with intermediate actions', () => {
  let action = {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-transaction'}};
  let initialState = {
    optimist: {
      'my-transaction': { state: {initial: 'state'}, actions: [{type: 'bar'}] }
    },
    lastAction: {type: 'bar'}
  };
  var call = 0;
  let res = optimist(function (state, a) {
    call++;
    if (call === 1) {
      assert.deepEqual(state, {initial: 'state'});
      assert.deepEqual(a, {type: 'bar'});
    }
    if (call === 2) {
      assert.deepEqual(state, {lastAction: {type: 'bar'}});
      assert.deepEqual(a, action);
    }
    if (call > 2) {
      throw new Error('Expected only 2 calls');
    }
    return {lastAction: a};
  })(initialState, action);
  assert.deepEqual(
    res,
    {
      optimist: {},
      lastAction: action
    }
  );
});

test('commit a transaction', () => {
  let action = {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-transaction'}};
  let initialState = {
    optimist: {
      'my-transaction': { state: {initial: 'state'}, actions: [] }
    },
    lastAction: {type: 'bar'}
  };
  let res = optimist(function (state, a) {
    assert.deepEqual(state, {lastAction: {type: 'bar'}});
    assert(a === action);
    return {lastAction: a};
  })(initialState, action);
  assert.deepEqual(
    res,
    {
      optimist: {},
      lastAction: action
    }
  );
});


test('real world example', () => {
  function originalReducer(state = {value: 0}, action) {
    switch (action.type) {
      case 'SET':
        return {value: action.value};
      case 'INCREMENT':
        return {value: state.value + 1};
      case 'INCREMENT_IF_EVEN':
        return state.value % 2 === 0 ? {value: state.value + 1} : state;
      default:
        return state;
    }
  }
  let reducer = optimist(originalReducer);
  let actionCreators = {
    set(value, transactionID) {
      return {
        type: 'SET',
        value: value,
        optimist: transactionID ? {type: optimist.BEGIN, id: transactionID} : undefined
      };
    },
    increment(transactionID) {
      return {
        type: 'INCREMENT',
        optimist: transactionID ? {type: optimist.BEGIN, id: transactionID} : undefined
      };
    },
    incrementIfEven(transactionID) {
      return {
        type: 'INCREMENT_IF_EVEN',
        optimist: transactionID ? {type: optimist.BEGIN, id: transactionID} : undefined
      };
    },
    commit(transactionID) {
      return {type: 'COMMIT', optimist: {type: optimist.COMMIT, id: transactionID}};
    },
    revert(transactionID) {
      return {type: 'REVERT', optimist: {type: optimist.REVERT, id: transactionID}};
    },
  };
  let actions = [
    {action: {type: '@@init'}, value: 0},
    {action: actionCreators.set(2), value: 2},
    {action: actionCreators.set(1, 'start-at-1'), value: 1},
    {action: actionCreators.incrementIfEven(), value: 1},
    {action: actionCreators.increment('inc'), value: 2},
    {action: actionCreators.commit('inc'), value: 2},
    {action: actionCreators.revert('start-at-1'), value: 4},
  ];
  let state;
  actions.forEach(({action, value}) => {
    state = reducer(state, action);
    assert(state.value === value);
  });
  assert.deepEqual(state, {optimist: {}, value: 4});
});
