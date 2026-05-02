'use strict';

function collapseWhitespace(text) {
  let result = text.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/[ \t]+$/gm, '');
  return result;
}

function stripComments(text) {
  let result = text.replace(/(?<!:)\/\/[^\n]*/g, '');
  result = result.replace(/(?<=\s)#[^\n]*/gm, '');
  result = result.replace(/^\s*\n/gm, '\n');
  return result;
}

function collapseImports(text) {
  const importRegex = /^(import\s+.+|const\s+.+=\s*require\(.+\));?\s*$/;
  const lines = text.split('\n');
  const result = [];
  let importBlock = [];

  for (let i = 0; i < lines.length; i++) {
    if (importRegex.test(lines[i].trim())) {
      importBlock.push(lines[i]);
    } else {
      if (importBlock.length > 0) {
        if (importBlock.length >= 2) {
          result.push(`[${importBlock.length} imports collapsed]`);
        } else {
          result.push(...importBlock);
        }
        importBlock = [];
      }
      result.push(lines[i]);
    }
  }

  if (importBlock.length >= 2) {
    result.push(`[${importBlock.length} imports collapsed]`);
  } else if (importBlock.length > 0) {
    result.push(...importBlock);
  }

  return result.join('\n');
}

function compress(text, tier) {
  if (tier === 'premium') {
    return {
      text,
      originalLength: text.length,
      compressedLength: text.length,
      savings: 0,
    };
  }

  const originalLength = text.length;
  let compressed = text;

  compressed = collapseWhitespace(compressed);

  if (tier === 'cheap') {
    compressed = stripComments(compressed);
    compressed = collapseImports(compressed);
    compressed = collapseWhitespace(compressed);
  }

  const compressedLength = compressed.length;
  const savings = originalLength > 0
    ? parseFloat(((originalLength - compressedLength) / originalLength).toFixed(4))
    : 0;

  return { text: compressed, originalLength, compressedLength, savings };
}

module.exports = { compress };
