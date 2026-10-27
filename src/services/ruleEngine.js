import { evaluateCropHealth } from "./decisionRules/cropHealth.js";
import { evaluateWeatherDryness } from "./decisionRules/weatherDryness.js";

const rules = [
  {
    name: "cropHealth",
    priority: 2,
    evaluate: evaluateCropHealth,
  },
  {
    name: "weatherDryness",
    priority: 1,
    evaluate: evaluateWeatherDryness,
  },
];

export function evaluateRules(context) {
  if (!context) {
    throw new Error("Decision context is required.");
  }

  const matchedRules = [];

  for (const rule of rules) {
    const decision = rule.evaluate(context);

    if (decision) {
      matchedRules.push({
        name: rule.name,
        priority: rule.priority,
        decision,
      });
    }
  }

  return matchedRules;
}

export function selectPrimaryDecision(matchedRules = []) {
  if (matchedRules.length === 0) {
    return null;
  }

  const sortedRules = [...matchedRules].sort(
    (a, b) => b.priority - a.priority
  );

  return sortedRules[0].decision;
}