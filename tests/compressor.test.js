const { describe, it } = require('node:test');
const assert = require('node:assert');
const { compress } = require('../src/compressor');

describe('compressor', () => {
  describe('whitespace cleanup', () => {
    it('collapses multiple blank lines', () => {
      const input = 'line1\n\n\n\nline2\n\n\nline3';
      const result = compress(input, 'mid');
      assert.strictEqual(result.text, 'line1\n\nline2\n\nline3');
    });

    it('trims trailing whitespace', () => {
      const input = 'line1   \nline2  \nline3';
      const result = compress(input, 'mid');
      assert.strictEqual(result.text, 'line1\nline2\nline3');
    });
  });

  describe('comment stripping (haiku only)', () => {
    it('strips single-line JS comments for haiku', () => {
      const input = 'const x = 1; // this is a comment\nconst y = 2;';
      const result = compress(input, 'cheap');
      assert.ok(!result.text.includes('// this is a comment'));
      assert.ok(result.text.includes('const x = 1;'));
    });

    it('strips Python comments for haiku', () => {
      const input = 'x = 1  # comment\ny = 2';
      const result = compress(input, 'cheap');
      assert.ok(!result.text.includes('# comment'));
    });

    it('does NOT strip comments for mid tier', () => {
      const input = 'const x = 1; // keep this comment';
      const result = compress(input, 'mid');
      assert.ok(result.text.includes('// keep this comment'));
    });
  });

  describe('import collapse (haiku only)', () => {
    it('collapses JS import blocks for haiku', () => {
      const input = "import React from 'react';\nimport { useState } from 'react';\nimport axios from 'axios';\n\nfunction App() {}";
      const result = compress(input, 'cheap');
      assert.ok(result.text.includes('[3 imports collapsed]'));
      assert.ok(result.text.includes('function App() {}'));
    });

    it('does NOT collapse imports for mid tier', () => {
      const input = "import React from 'react';\nimport axios from 'axios';\n\nfunction App() {}";
      const result = compress(input, 'mid');
      assert.ok(result.text.includes("import React from 'react'"));
    });
  });

  describe('no compression for premium', () => {
    it('returns input unchanged for premium tier', () => {
      const input = 'const x = 1; // comment\n\n\n\nline2';
      const result = compress(input, 'premium');
      assert.strictEqual(result.text, input);
      assert.strictEqual(result.savings, 0);
    });
  });

  describe('result structure', () => {
    it('returns text, originalLength, compressedLength, savings', () => {
      const result = compress('hello   \n\n\n\nworld', 'mid');
      assert.ok('text' in result);
      assert.ok('originalLength' in result);
      assert.ok('compressedLength' in result);
      assert.ok('savings' in result);
      assert.ok(result.savings >= 0 && result.savings <= 1);
    });
  });
});
