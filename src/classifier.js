'use strict';

const HAIKU_PATTERNS = [
  { pattern: /^(hi|hello|hey|yes|no|ok|okay|thanks|thank you|gracias|sí|vale|sure|yep|nope)[\s!?.]*$/i, signal: 'greeting_or_confirmation' },
  { pattern: /^(what|where|when|who|how many|how much|qué|dónde|cuándo|quién)\b/i, signal: 'factual_question' },
  { pattern: /\b(git status|git log|git diff|git branch|commit message|git show)\b/i, signal: 'git_ops' },
  { pattern: /\b(read|show|cat|print|display|muestra|lee|list)\b.*\b(file|content|code|output|json|\.js|\.py|\.txt)\b/i, signal: 'file_reading' },
  { pattern: /\bwhat does this error mean\b/i, signal: 'error_lookup' },
  { pattern: /^(run|execute|check|verify|test)\s/i, signal: 'simple_command' },
];

const OPUS_PATTERNS = [
  { pattern: /\b(architect|design|redesign|refactor|restructur|rediseñ)/i, signal: 'architecture' },
  { pattern: /\b(debug|troubleshoot)\b.*\b(fail|crash|broken|not work|error|issue)/i, signal: 'complex_debug' },
  { pattern: /\bwhy\b.*\b(fail|crash|broken|not work|error)/i, signal: 'why_failing' },
  { pattern: /\b(across|multiple files|all files|every file|todos los archivos|entire codebase)/i, signal: 'multi_file' },
  { pattern: /\b(write a|create a|build a|implement|genera|crea|construye)\b/i, signal: 'generation' },
  { pattern: /\b(explain|compare|analyze|evalua|analiz).*\b(detail|depth|thorough|comprehensive)/i, signal: 'deep_analysis' },
  { pattern: /\b(migrate|migration|convert|transform)\b.*\b(from|to|into)\b/i, signal: 'migration' },
  { pattern: /```[\s\S]{50,}```/, signal: 'code_in_prompt' },
  { pattern: /\b(fix|solve|resolve)\b[\s\S]{20,}/, signal: 'non_trivial_fix' },
  { pattern: /\b(complete|finish|finalize)\b[\s\S]{15,}/i, signal: 'completion_task' },
];

const SHORT_THRESHOLD = 200;
const LONG_THRESHOLD = 1000;

function classify(prompt) {
  const text = (prompt || '').trim();
  const signals = [];
  let score = 0.5;

  let haikuHits = 0;
  for (const { pattern, signal } of HAIKU_PATTERNS) {
    if (pattern.test(text)) {
      signals.push(signal);
      haikuHits++;
    }
  }

  let opusHits = 0;
  for (const { pattern, signal } of OPUS_PATTERNS) {
    if (pattern.test(text)) {
      signals.push(signal);
      opusHits++;
    }
  }

  if (text.length < SHORT_THRESHOLD) signals.push('short_prompt');
  if (text.length > LONG_THRESHOLD) signals.push('long_prompt');

  if (opusHits > 0 || text.length > LONG_THRESHOLD) {
    score = 0.7 + (opusHits * 0.05);
    if (score > 1) score = 1;
  } else if (haikuHits > 0 && text.length < SHORT_THRESHOLD) {
    score = 0.1 + (haikuHits > 1 ? 0 : 0.05);
  } else if (haikuHits > 0) {
    score = 0.25;
  }

  let tier;
  if (score < 0.3) tier = 'cheap';
  else if (score > 0.6) tier = 'premium';
  else tier = 'mid';

  return { score: parseFloat(score.toFixed(2)), tier, signals };
}

module.exports = { classify };
