/* eslint-disable no-alert, no-restricted-globals */

/**
 * Encapsulated dialog wrappers to comply with eslint no-alert and no-restricted-globals rules in components.
 */

export const showConfirm = (message: string): boolean => {
  return window.confirm(message);
};

export const showAlert = (message: string): void => {
  window.alert(message);
};
