import {createStore} from '../store';

test('setState merges and notifies subscribers', () => {
  const store = createStore({a: 1, b: 2});
  const seen = [];
  const unsubscribe = store.subscribe(s => seen.push(s));
  store.setState({b: 3});
  expect(store.getState()).toEqual({a: 1, b: 3});
  expect(seen).toEqual([{a: 1, b: 3}]);
  unsubscribe();
  store.setState({a: 5});
  expect(seen).toHaveLength(1);
});
