'use strict';

import assert from 'assert';
import test from 'testit';
import {diffLines} from 'diff';
import chalk from 'chalk';
import optimist from '../src';

function deepEqual(expected, actual) {
  expected = JSON.stringify(expected, null, '  ');
  actual = JSON.stringify(actual, null, '  ');
  if (expected !== actual) {
    var diff = diffLines(actual, expected);
    var err = '';
    diff.forEach(function (chunk) {
      err += chunk.added ? chalk.red(chunk.value) : chunk.removed ? chalk.green(chunk.value) : chunk.value;
    });
    throw err;
  }
}
function getWarnings(fn) {
  var warnings = [];
  var ce = console.error;
  console.error = err => warnings.push(err);
  fn();
  console.error = ce;
  return warnings;
}

test('errors and warnings', () => {
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
    assert.deepEqual(res, {optimist: [], lastAction: action});
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
      ['Cannot commit transaction with id "my-transaction" because it does not exist']
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
      ['Cannot revert transaction with id "my-transaction" because it does not exist']
    );
    assert.deepEqual(res, {optimist: {}, lastAction: action});
  });
});

basic('beginning a transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {initial: 'state'},
  action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}},
  after: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
  }
});
basic('within a transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
  },
  action: {type: 'foo'},
  after: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {action: {type: 'foo'}}
    ],
    lastAction: {type: 'foo'}
  }
});
basic('nest a transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
  },
  action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}},
  after: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        beforeState: {lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
    ],
    lastAction: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
  }
});
basic('revert a transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        beforeState: {lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
    ],
    lastAction: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
  },
  action: {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-transaction'}},
  after: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
      {
        action: {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-transaction'}},
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-transaction'}},
  }
});
basic('revert other transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        beforeState: {lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
    ],
    lastAction: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
  },
  action: {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-other-transaction'}},
  after: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        action: {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-other-transaction'}},
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.REVERT, id: 'my-other-transaction'}},
  }
});
basic('commit a transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        beforeState: {lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
    ],
    lastAction: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
  },
  action: {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-transaction'}},
  after: {
    optimist: [
      {
        beforeState: {lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
      {
        action: {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-transaction'}},
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-transaction'}},
  }
});
basic('commit other transaction', {
  reducer: (state, a) => ({lastAction: a}),
  before: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        beforeState: {lastAction: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}},
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
    ],
    lastAction: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
  },
  action: {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-other-transaction'}},
  after: {
    optimist: [
      {
        beforeState: {initial: 'state'},
        action: {type: 'foo', optimist: {type: optimist.BEGIN, id: 'my-transaction'}}
      },
      {
        action: {type: 'bar', optimist: {type: optimist.BEGIN, id: 'my-other-transaction'}}
      },
      {
        action: {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-other-transaction'}},
      }
    ],
    lastAction: {type: 'foo', optimist: {type: optimist.COMMIT, id: 'my-other-transaction'}},
  }
});

test('omits optimist from original reducer', () => {
  function originalReducer(state = {value: 0}, action) {
    assert(state.value === 0);
    assert(!state.hasOwnProperty('optimist'));
    return state;
  }
  let reducer = optimist(originalReducer);
  let state;
  state = reducer(state, {type: 'foo'});
  state = reducer(state, {type: 'foo'});
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
  deepEqual(state, {optimist: [], value: 4});
});

test('real world example 2', () => {
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
        optimist: transactionID ? {id: transactionID} : undefined
      };
    },
    increment(transactionID) {
      return {
        type: 'INCREMENT',
        optimist: transactionID ? {id: transactionID} : undefined
      };
    },
    incrementIfEven(transactionID) {
      return {
        type: 'INCREMENT_IF_EVEN',
        optimist: transactionID ? {id: transactionID} : undefined
      };
    },
    begin(transactionID) {
      return {type: 'BEGIN', optimist: {type: optimist.BEGIN, id: transactionID}};
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
    {action: actionCreators.begin('start-at-1'), value: 2},
    {action: actionCreators.set(1, 'start-at-1'), value: 1},
    {action: actionCreators.incrementIfEven(), value: 1},
    {action: actionCreators.increment('start-at-1'), value: 2},
    {action: actionCreators.begin('inc'), value: 2},
    {action: actionCreators.increment('inc'), value: 3},
    {action: actionCreators.commit('inc'), value: 3},
    {action: actionCreators.revert('start-at-1'), value: 4},
  ];
  let state;
  actions.forEach(({action, value}) => {
    state = reducer(state, action);
    assert(state.value === value);
  });
  assert.deepEqual(state, {optimist: [], value: 4});
});

test('calls original reducer max of one time per action', () => {
  let calls = 0;
  function originalReducer(state) {
    calls++;
    return {};
  }
  let reducer = optimist(originalReducer);
  let state;
  state = reducer(state, {type: '@@init'});
  state = reducer(state, {type: 'foo'});
  assert.equal(calls, 2);
});

test('unhandled action state reference', () => {
  let originalReducer = (state = {}) => state;
  let reducer = optimist(originalReducer);
  let initState = reducer(undefined, {type: '@@init'});
  let originalState = reducer(initState, {type: 'foo'});
  let nextState = reducer(originalState, {type: 'foo'});
  assert.strictEqual(originalState, nextState);
});

function basic(name, {reducer, before, action, after}) {
  test(name, () => {
    let res = optimist(function (state, a) {
      /*
      if (before) {
        let {optimist, ...filteredBefore} = before;
        assert.deepEqual(state, filteredBefore);
      } else {
        assert(state === before);
      }
      assert(a === action, 'action should be passed through to reducer');
      */
      return reducer(state, a);
    })(before, action);
    deepEqual(res, after);
  });
}
