/* Pilates local storage adapter v1.0
 * Stable storage boundary for the current local-first application.
 * This adapter deliberately keeps the existing key and synchronous semantics.
 * It does not connect to a cloud service or transmit data.
 */
(function (root) {
  "use strict";
  const STORAGE_KEY = "emoveo.pilates.local.v1";

  function getItem() {
    return root.localStorage.getItem(STORAGE_KEY);
  }

  function setItem(value) {
    root.localStorage.setItem(STORAGE_KEY, value);
    return true;
  }

  function removeItem() {
    root.localStorage.removeItem(STORAGE_KEY);
    return true;
  }

  root.PilatesStorageV1 = Object.freeze({
    mode: "local",
    key: STORAGE_KEY,
    getItem,
    setItem,
    removeItem
  });
})(typeof window !== "undefined" ? window : globalThis);
