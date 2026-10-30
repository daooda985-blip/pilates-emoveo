/* Pilates generator v1.1 — duration-aware rule-based prototype */
(function (root) {
  "use strict";
  const STAGE_ORDER = ["warm_up", "main", "stretch"];
  const DEFAULT_SPLIT = { warm_up: 15, main: 30, stretch: 15 };
  const REST_BREAKS_SECONDS = [15, 15];
  const STEP = 0.5;
  const round1 = n => Math.round(n * 10) / 10;
  const units = n => Math.round(n / STEP);
  function shuffleCopy(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function normalizeOptions(o) {
    return {
      totalMinutes: Math.max(15, Number(o.totalMinutes || 60)),
      level: o.level || "medium",
      goals: Array.isArray(o.goals) ? o.goals : ["posture", "core"],
      equipment: Array.isArray(o.equipment) ? o.equipment : ["mat", "wall", "chair"],
      excludedIds: new Set(o.excludedIds || []),
      previousIds: new Set(o.previousIds || []),
      random: o.random || Math.random
    };
  }
  function stageSplit(total) {
    if (total === 60) return { ...DEFAULT_SPLIT };
    const warm = Math.round(total * 0.25 * 2) / 2;
    const main = Math.round(total * 0.50 * 2) / 2;
    return { warm_up: warm, main, stretch: round1(total - warm - main) };
  }
  function hasEquipment(card, equipment) {
    const e = (card.equipment || "").toLowerCase();
    const has = id => equipment.includes(id);
    if (!e || e.includes("не требуется")) return true;

    // A mat is a genuine requirement when named; optional props remain optional.
    if (e.includes("коврик") && !has("mat")) return false;

    // "Wall/chair" and "wall or stable support" allow either available support.
    if (e.includes("стена") && e.includes("стул")) {
      if (!has("wall") && !has("chair") && !e.includes("по необходимости")) return false;
    } else if (e.includes("стена") && e.includes("или устойчивая опора")) {
      if (!has("wall") && !has("chair") && !e.includes("по необходимости")) return false;
    } else if (e.includes("стена") && !has("wall") && !e.includes("по необходимости")) {
      return false;
    }

    if (e.includes("стул") && !has("chair") &&
        !e.includes("по необходимости") && !e.includes("необязательно") &&
        !e.includes("стена/стул")) return false;
    if (e.includes("ремень") && !has("band") &&
        !e.includes("необязательно") && !e.includes("по необходимости")) return false;
    if (e.includes("мяч") && !has("ball")) return false;
    if (e.includes("кольцо") && !has("ring")) return false;
    if (e.includes("блок") && !has("block")) return false;
    if (e.includes("гантел") && !has("weights")) return false;
    return true;
  }
  function goalMatches(card, goals) {
    const map = {
      posture: ["posture", "shoulders", "scapular_control", "upper_back"],
      arms: ["shoulders", "upper_back"], core: ["core", "core_control"],
      legs: ["legs", "glutes", "hips"],
      mobility: ["mobility", "spine_mobility", "thoracic_rotation"],
      balance: ["balance", "coordination"],
      flexibility: ["stretch", "hamstrings", "glutes", "hips", "chest", "side_body"]
    };
    const wanted = new Set(goals.flatMap(g => map[g] || [g]));
    return (card.tags || []).some(t => wanted.has(t));
  }
  function compatible(c, stage) {
    return c.stage === stage || (c.stage === "warm_up_or_main" && ["warm_up", "main"].includes(stage));
  }
  function chooseStage(library, stage, targetMinutes, options, used, coveredFocus) {
    const target = units(targetMinutes);
    const candidates = shuffleCopy(library.cards.filter(c =>
      compatible(c, stage) && !used.has(c.id) && !options.excludedIds.has(c.id) &&
      hasEquipment(c, options.equipment) &&
      !(options.level === "beginner" && (c.tags || []).includes("higher_control"))
    ), options.random);
    const groups = [...new Set(candidates.flatMap(c => c.body_focus || ["общая подвижность"]))];
    const groupIndex = new Map(groups.map((g, i) => [g, i]));
    const items = candidates.map(card => ({
      card, units: Math.max(1, units(Number(card.estimated_active_minutes || 1.5))),
      groups: (card.body_focus || ["общая подвижность"]).map(g => groupIndex.get(g)).filter(i => i !== undefined),
      baseScore: (goalMatches(card, options.goals) ? 6 : 0) + (options.previousIds.has(card.id) ? 0 : 1)
    })).filter(x => x.units <= target);
    // Dynamic programming balances target relevance and body-focus coverage.
    const dp = Array.from({ length: target + 1 }, () => new Map());
    dp[0].set(0, { score: 0, picks: [] });
    for (const item of items) {
      for (let t = target; t >= item.units; t--) {
        for (const [mask, prev] of [...dp[t - item.units].entries()]) {
          let nextMask = mask, novelty = 0;
          for (const index of item.groups) {
            const bit = 1 << index;
            if (!(nextMask & bit) && !coveredFocus.has(groups[index])) novelty += 2;
            nextMask |= bit;
          }
          const candidate = { score: prev.score + item.baseScore + novelty, picks: prev.picks.concat(item) };
          const existing = dp[t].get(nextMask);
          if (!existing || candidate.score > existing.score) dp[t].set(nextMask, candidate);
        }
      }
    }
    let filled = target;
    while (filled > 0 && dp[filled].size === 0) filled--;
    const states = [...dp[filled].values()].sort((x,y) => y.score - x.score);
    const selected = states.length ? states[0].picks.map(x => x.card) : [];
    selected.forEach(c => { used.add(c.id); (c.body_focus || []).forEach(g => coveredFocus.add(g)); });
    const estimated = round1(selected.reduce((s, c) => s + Number(c.estimated_active_minutes || 1.5), 0));
    const remaining = round1(Math.max(0, targetMinutes - estimated));
    return {
      stage, targetMinutes, estimatedSelectedMinutes: estimated, remainingMinutes: remaining,
      exercises: selected, complete: remaining <= 0.01,
      focusCoverage: [...new Set(selected.flatMap(c => c.body_focus || []))],
      note: remaining > 0.01
        ? `Не хватает ${remaining} мин по текущим оценкам. Не повторяйте упражнения и не удлиняйте дозировку искусственно; добавьте проверенные карточки или измените длительность этапа.`
        : null
    };
  }
  function validatePlan(plan, options) {
    const errors = [], warnings = [];
    if (plan.stages.length !== 3 || STAGE_ORDER.some((s, i) => plan.stages[i].stage !== s))
      errors.push("Нарушен порядок этапов.");
    for (const s of plan.stages) {
      if (!s.exercises.length) errors.push("Пустой этап: " + s.stage);
      if (s.estimatedSelectedMinutes > s.targetMinutes + 0.01) errors.push("Превышен лимит времени этапа: " + s.stage);
      if (!s.complete) warnings.push(`Этап ${s.stage} короче цели на ${s.remainingMinutes} мин.`);
      for (const c of s.exercises) {
        if (!c.id || !c.name_ru || !c.technique_steps?.length || !c.safety_notes)
          errors.push("Неполная карточка: " + (c.id || "без ID"));
      }
    }
    const all = plan.stages.flatMap(s => s.exercises), ids = all.map(c => c.id);
    if (new Set(ids).size !== ids.length) errors.push("Есть повторяющиеся упражнения.");
    if (all.some(c => options.excludedIds.has(c.id))) errors.push("Включено исключённое упражнение.");
    return {
      valid: errors.length === 0, errors, warnings,
      estimatedActiveMinutes: round1(plan.stages.reduce((n, s) => n + s.estimatedSelectedMinutes, 0)),
      targetStageMinutes: round1(plan.stages.reduce((n, s) => n + s.targetMinutes, 0))
    };
  }
  function generate(library, raw = {}) {
    const o = normalizeOptions(raw), split = stageSplit(o.totalMinutes), used = new Set();
    const coveredFocus = new Set();
    const stages = STAGE_ORDER.map(s => chooseStage(library, s, split[s], o, used, coveredFocus));
    const active = round1(stages.reduce((n, s) => n + s.estimatedSelectedMinutes, 0));
    const breaks = REST_BREAKS_SECONDS.reduce((a, b) => a + b, 0);
    const plan = {
      title: "Pilates — черновик занятия", generatedAt: new Date().toISOString(),
      mode: "rule_based_duration_aware", level: o.level, goals: o.goals, equipment: o.equipment,
      targetMinutes: o.totalMinutes, stageSplit: split, restBreaksSeconds: REST_BREAKS_SECONDS,
      restBreaksTotalSeconds: breaks, transitionsCounted: false,
      estimatedActiveMinutes: active,
      estimatedTotalMinutesIncludingBreaks: round1(active + breaks / 60), stages
    };
    plan.validation = validatePlan(plan, o);
    plan.validation.warnings.push(
      "Длительность карточек — оценка активного времени, не секундомер.",
      "Две паузы по 15 секунд добавляются отдельно; переходы не учитываются.",
      "Если библиотека не заполняет этап, дефицит показывается явно."
    );
    return plan;
  }
  function canUseCard(card, raw = {}) {
    const options = normalizeOptions(raw), stage = raw.stage || "main";
    return compatible(card, stage) && hasEquipment(card, options.equipment) &&
      !(options.level === "beginner" && (card.tags || []).includes("higher_control")) &&
      !options.excludedIds.has(card.id);
  }
  const api = { generate, validatePlan, stageSplit, canUseCard, STAGE_ORDER, REST_BREAKS_SECONDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.PilatesGeneratorV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

