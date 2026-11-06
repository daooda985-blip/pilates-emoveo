"use strict";

const assert = require("node:assert/strict");
const library = require("../data/exercise-library.v1.json");
const generator = require("../js/generator.v1.js");

const REST_MINUTES = 0.5;
const durations = [30, 45, 60, 75, 90];

for (const total of durations) {
  const split = generator.stageSplit(total);
  const stagesTotal = split.warm_up + split.main + split.stretch;

  assert.ok(Math.abs(stagesTotal + REST_MINUTES - total) < 0.001,
    `Stage split plus two 15-second rests must equal ${total} minutes`);
  assert.ok(split.main >= split.warm_up && split.main >= split.stretch,
    `Main stage must remain the largest stage for ${total} minutes`);
}

// Verify that generated duration accounting exposes shortages instead of hiding them.
for (const totalMinutes of durations) {
  const plan = generator.generate(library, {
    totalMinutes,
    level: "medium",
    goals: ["posture", "core", "arms", "legs"],
    equipment: ["mat"],
    random: () => 0.314159
  });
  const remaining = plan.stages.reduce((sum, stage) => sum + stage.remainingMinutes, 0);

  assert.ok(plan.estimatedTotalMinutesIncludingBreaks <= totalMinutes + 0.001,
    `The generated plan must not exceed ${totalMinutes} minutes`);
  assert.ok(Math.abs(plan.estimatedTotalMinutesIncludingBreaks + remaining - totalMinutes) < 0.001,
    `Selected time plus visible shortages must account for the ${totalMinutes}-minute target`);

  for (const stage of plan.stages) {
    assert.equal(stage.complete, stage.remainingMinutes <= 0.01,
      `Stage completion flag must match its remaining time for ${totalMinutes} minutes`);
  }
  if (remaining > 0.01) {
    assert.ok(plan.validation.warnings.some(warning => warning.includes("короче цели")),
      `A ${totalMinutes}-minute plan with a shortage must show a validation warning`);
  }
}

const card = id => {
  const found = library.cards.find(item => item.id === id);
  assert.ok(found, `Expected exercise card ${id}`);
  return found;
};

assert.equal(generator.canUseCard(card("WARM_001"), {
  stage: "warm_up", equipment: ["mat"]
}), true, "A mat-based warm-up must remain available");

assert.equal(generator.canUseCard(card("STR_003"), {
  stage: "stretch", equipment: ["mat"]
}), true, "An optional strap must not be required");

assert.equal(generator.canUseCard(card("POST_003"), {
  stage: "main", equipment: ["mat"]
}), true, "An optional chair must not be required");

assert.equal(generator.canUseCard(card("MOB_005"), {
  stage: "main", equipment: ["mat"]
}), true, "A chair listed as needed only when necessary must remain optional");

assert.equal(generator.canUseCard(card("POST_006"), {
  stage: "main", equipment: ["mat"]
}), false, "A wall-required exercise must be filtered without a wall");

assert.equal(generator.canUseCard(card("POST_006"), {
  stage: "main", equipment: ["mat", "wall"]
}), true, "A wall-required exercise must be available with a wall");

assert.equal(generator.canUseCard(card("POST_007"), {
  stage: "main", equipment: ["mat"]
}), false, "A chair-required exercise must be filtered without a chair");

assert.equal(generator.canUseCard(card("BAL_001"), {
  stage: "main", equipment: ["mat"]
}), true, "An explicitly optional wall/chair support must remain optional");

for (const totalMinutes of [60, 90]) {
  const plan = generator.generate(library, {
    totalMinutes,
    level: "medium",
    goals: ["posture", "core", "arms", "legs"],
    equipment: ["mat"],
    random: () => 0.314159
  });

  assert.equal(plan.stages.length, 3, "Every plan must contain three stages");
  assert.equal(plan.validation.errors.length, 0,
    `The ${totalMinutes}-minute plan must not contain structural errors`);

  const ids = plan.stages.flatMap(stage => stage.exercises.map(exercise => exercise.id));
  assert.equal(new Set(ids).size, ids.length, "An exercise must not repeat within a plan");

  for (const stage of plan.stages) {
    for (const exercise of stage.exercises) {
      assert.equal(generator.canUseCard(exercise, {
        stage: stage.stage,
        level: "medium",
        equipment: ["mat"]
      }), true, `Selected exercise ${exercise.id} must match available equipment`);
    }
  }
}

console.log("Pilates generator regression checks passed.");
