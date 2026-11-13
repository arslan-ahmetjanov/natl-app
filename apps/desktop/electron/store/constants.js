// Predefined actions for TestBlox
exports.PREDEFINED_ACTIONS = [
  { name: 'click', withValue: false },
  { name: 'fill', withValue: true },
  { name: 'hover', withValue: false },
  { name: 'checkText', withValue: true },
  { name: 'waitForElement', withValue: true },
  { name: 'goBack', withValue: false },
  { name: 'goForward', withValue: false },
  { name: 'selectOption', withValue: true },
  { name: 'checkVisibility', withValue: false },
  { name: 'pressKey', withValue: true },
  { name: 'clearInput', withValue: false },
  { name: 'doubleClick', withValue: false },
  { name: 'rightClick', withValue: false },
  { name: 'focus', withValue: false },
  { name: 'blur', withValue: false },
  { name: 'takeScreenshot', withValue: true },
];

// Default viewports (common resolutions)
exports.DEFAULT_VIEWPORTS = [
  { title: 'Desktop 1920x1080', width: 1920, height: 1080 },
  { title: 'Desktop 1366x768', width: 1366, height: 768 },
  { title: 'Tablet 768x1024', width: 768, height: 1024 },
  { title: 'Mobile 375x667', width: 375, height: 667 },
];
