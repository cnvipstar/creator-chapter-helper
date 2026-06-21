(function initXiaohongshuMainWorldBridge() {
  if (window.__CCH_XHS_MAIN_WORLD_BRIDGE__) {
    return;
  }
  window.__CCH_XHS_MAIN_WORLD_BRIDGE__ = true;

  const EVENT_NAME = 'cch:xhs-fill-value';

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function dispatchInputEvents(element, value) {
    const inputEvent = typeof InputEvent === 'function'
      ? new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: value
      })
      : new Event('input', { bubbles: true, cancelable: true, composed: true });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true, composed: true }));
  }

  window.addEventListener(EVENT_NAME, (event) => {
    const id = event && event.detail ? String(event.detail) : '';
    if (!id || !/^[a-z0-9-]+$/i.test(id)) {
      return;
    }

    const element = document.querySelector(`[data-cch-xhs-fill-id="${id}"]`);
    if (!element) {
      return;
    }

    const value = element.getAttribute('data-cch-xhs-fill-value') || '';
    element.focus();
    setNativeValue(element, value);
    dispatchInputEvents(element, value);
  });
})();

