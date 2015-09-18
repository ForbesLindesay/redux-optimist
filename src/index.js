'use strict';

var BEGIN = 'BEGIN';
var COMMIT = 'COMMIT';
var REVERT = 'REVERT';
var INITIAL_OPTIMIST = {};

module.exports = optimist;
module.exports.BEGIN = BEGIN;
module.exports.COMMIT = COMMIT;
module.exports.REVERT = REVERT;
function optimist(fn) {
  return function (state, action) {
    let {optimist = INITIAL_OPTIMIST, ...oldState} = (state || {});
    let oldOptimist = optimist;
    if (!state) oldState = undefined;
    if (
      action.optimist &&
      (action.optimist.type === COMMIT || action.optimist.type === REVERT)
    ) {
      let {[action.optimist.id]: transaction, ...transactions} = optimist;
      if (!transaction) {
        console.error(
          'Cannot ' +
          action.optimist.type +
          ' transaction with id "' +
          action.optimist.id +
          '" because it does not exist'
        );
      }
      optimist = transactions;
      if (transaction && action.optimist.type === REVERT) {
        let {state, actions} = transaction;
        actions.forEach(function (action) {
          state = fn(state, action);
        });
        oldState = state;
      }
    }
    if (Object.keys(optimist).length) {
      let newOptimist = {};
      Object.keys(optimist).forEach(function (key) {
	if (action.optimist && action.optimist.id == key) {
          newOptimist[key] = optimist[key];
	}
	else {
          newOptimist[key] = {state: optimist[key].state, actions: optimist[key].actions.concat([action])};
	}
      });
      optimist = newOptimist;
    }
    if (action.optimist && action.optimist.type === BEGIN) {
      if (action.optimist.id in optimist) {
        console.error(
          'Implicitly committing transaction with id "' +
          action.optimist.id +
          '" because it already exists, and you are starting' +
          ' it again.'
        );
      }
      if (!state) {
        console.error(
          'You should never begin an optimistic transaction before initializing your store.' +
          ' You would have nothing to revert to!'
        );
      }
      optimist = {
        ...optimist,
        [action.optimist.id]: {state: oldState, actions: []}
      };
    }
    let newState = fn(oldState, action);
    if (!newState || typeof newState !== 'object' || Array.isArray(newState)) {
      throw new TypeError(
        'Error while handling "' +
        action.type +
        '": Optimist requires that state is always a plain object.'
      );
    }
    if (oldOptimist !== optimist || !equal(newState, oldState)) return {optimist, ...newState};
    else return state;
  };
}

function equal(newState, oldState) {
  if (newState === oldState) return true;
  if (!(newState && oldState)) return false;
  for (let key in newState) {
    if (newState[key] !== oldState[key]) {
      return false;
    }
  }
  for (let key in oldState) {
    if (newState[key] !== oldState[key]) {
      return false;
    }
  }
  return true;
}
