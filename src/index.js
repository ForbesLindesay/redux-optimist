'use strict';

var BEGIN = 'BEGIN';
var COMMIT = 'COMMIT';
var REVERT = 'REVERT';
// Array({transactionID: string or null, beforeState: {object}, action: {object}}
var INITIAL_OPTIMIST = [];

module.exports = optimist;
module.exports.BEGIN = BEGIN;
module.exports.COMMIT = COMMIT;
module.exports.REVERT = REVERT;
function optimist(fn, mapActionToOptimist = action => action.optimist) {
  function beginReducer(state, action) {
    let {optimist, innerState} = separateState(state);
    optimist = optimist.concat([{beforeState: innerState, action}]);
    innerState = fn(innerState, action);
    validateState(innerState, action);
    return {optimist, ...innerState};
  }
  function commitReducer(state, action) {
    let {optimist, innerState} = separateState(state);
    const optimistAction = mapActionToOptimist(action);
    var newOptimist = [], started = false, committed = false;
    optimist.forEach(function (entry) {
      if (started) {
        if (
          entry.beforeState &&
          matchesTransaction(entry.action, optimistAction.id)
        ) {
          committed = true;
          newOptimist.push({action: entry.action});
        } else {
          newOptimist.push(entry);
        }
      } else if (
        entry.beforeState &&
        !matchesTransaction(entry.action, optimistAction.id)
      ) {
        started = true;
        newOptimist.push(entry);
      } else if (
        entry.beforeState &&
        matchesTransaction(entry.action, optimistAction.id)
      ) {
        committed = true;
      }
    });
    if (!committed) {
      console.error('Cannot commit transaction with id "' + optimistAction.id + '" because it does not exist');
    }
    optimist = newOptimist;
    return baseReducer(optimist, innerState, action);
  }
  function revertReducer(state, action) {
    let {optimist, innerState} = separateState(state);
    const optimistAction = mapActionToOptimist(action);
    var newOptimist = [], started = false, gotInitialState = false, currentState = innerState;
    optimist.forEach(function (entry) {
      if (
        entry.beforeState &&
        matchesTransaction(entry.action, optimistAction.id)
      ) {
        currentState = entry.beforeState;
        gotInitialState = true;
      }
      if (!matchesTransaction(entry.action, optimistAction.id)) {
        if (
          entry.beforeState
        ) {
          started = true;
        }
        if (started) {
          if (gotInitialState && entry.beforeState) {
            newOptimist.push({
              beforeState: currentState,
              action: entry.action
            });
          } else {
            newOptimist.push(entry);
          }
        }
        if (gotInitialState) {
          currentState = fn(currentState, entry.action);
          validateState(innerState, action);
        }
      }
    });
    if (!gotInitialState) {
      console.error('Cannot revert transaction with id "' + optimistAction.id + '" because it does not exist');
    }
    optimist = newOptimist;
    return baseReducer(optimist, currentState, action);
  }
  function baseReducer(optimist, innerState, action) {
    if (optimist.length) {
      optimist = optimist.concat([{action}]);
    }
    innerState = fn(innerState, action);
    validateState(innerState, action);
    return {optimist, ...innerState};
  }
  function matchesTransaction(action, id) {
    const optimistAction = mapActionToOptimist(action);
    return (
      optimistAction &&
      optimistAction.id === id
    );
  }
  return function (state, action) {
    const optimistAction = mapActionToOptimist(action);
    if (optimistAction) {
      switch (optimistAction.type) {
        case BEGIN:
          return beginReducer(state, action);
        case COMMIT:
          return commitReducer(state, action);
        case REVERT:
          return revertReducer(state, action);
      }
    }
    let separated = separateState(state);
    return baseReducer(separated.optimist, separated.innerState, action);
  };
}

function validateState(newState, action) {
  if (!newState || typeof newState !== 'object' || Array.isArray(newState)) {
    throw new TypeError(
      'Error while handling "' +
      action.type +
      '": Optimist requires that state is always a plain object.'
    );
  }
}

function separateState(state) {
  if (!state) {
    return {optimist: INITIAL_OPTIMIST, innerState: state};
  } else {
    let {optimist = INITIAL_OPTIMIST, ...innerState} = state;
    return {optimist, innerState};
  }
}
