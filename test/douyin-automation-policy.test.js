const assert = require('node:assert/strict');
const test = require('node:test');

const {
  decideManualInputAction
} = require('../src/lib/douyin-automation-policy');

test('uses existing manual inputs when both fields are present', () => {
  assert.equal(
    decideManualInputAction({
      hasTitleInput: true,
      hasSummaryInput: true,
      hasManualTrigger: false
    }),
    'ready'
  );
});

test('opens manual input area again after Douyin hides fields between chapters', () => {
  assert.equal(
    decideManualInputAction({
      hasTitleInput: false,
      hasSummaryInput: false,
      hasManualTrigger: true
    }),
    'open-manual'
  );
});

test('reports missing input area when neither fields nor trigger are available', () => {
  assert.equal(
    decideManualInputAction({
      hasTitleInput: false,
      hasSummaryInput: false,
      hasManualTrigger: false
    }),
    'missing'
  );
});
