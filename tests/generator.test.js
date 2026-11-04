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
