(function () {
  "use strict";
  // Authored examples, kept distinct from live model output.
  window.LingoPractice = {
    lessons: {
      zh: [
        { id: "zh-sequence", title: "One step, then the next", pattern: "先…，再…", description: "Use 先 before the first action and 再 before the next one.", example: "先了解问题，再讨论方案。", pronunciation: "Xiān liǎojiě wèntí, zài tǎolùn fāng'àn.", translation: "First understand the problem, then discuss the plan.", prompt: "Complete: 先看例子，___自己练习。", options: ["再", "比", "的"], answer: "再", explanation: "再 connects the next action: first look at the example, then practise on your own." },
        { id: "zh-comparison", title: "Make a comparison", pattern: "A 比 B + adjective", description: "Place 比 between the two things you compare, followed by an adjective.", example: "这个方案比那个方案简单。", pronunciation: "Zhège fāng'àn bǐ nàge fāng'àn jiǎndān.", translation: "This plan is simpler than that plan.", prompt: "Complete: 今天的任务___昨天的任务容易。", options: ["了", "比", "再"], answer: "比", explanation: "比 introduces the comparison: today's task is easier than yesterday's task." },
        { id: "zh-purpose", title: "Explain your purpose", pattern: "为了…，…", description: "Use 为了 to introduce the purpose of an action.", example: "为了提高效率，我们先制定计划。", pronunciation: "Wèile tígāo xiàolǜ, wǒmen xiān zhìdìng jìhuà.", translation: "To improve efficiency, we first make a plan.", prompt: "Complete: ___学习中文，我每天阅读。", options: ["比", "为了", "再"], answer: "为了", explanation: "为了 expresses purpose: I read every day in order to learn Chinese." }
      ],
      en: [
        { id: "en-plan", title: "Talk about your plans", pattern: "plan to + verb", description: "Use the base form of a verb after “plan to”.", example: "We plan to improve the service.", pronunciation: "", translation: "Plánujeme zlepšiť službu.", prompt: "Complete: We plan to ___ the project next week.", options: ["starting", "start", "started"], answer: "start", explanation: "After “plan to”, use the base form: “start”." },
        { id: "en-comparison", title: "Compare two ideas", pattern: "comparative + than", description: "Use a comparative adjective with “than” when comparing two things.", example: "This plan is simpler than the previous one.", pronunciation: "", translation: "Tento plán je jednoduchší ako predchádzajúci.", prompt: "Complete: This task is easier ___ yesterday's task.", options: ["then", "than", "that"], answer: "than", explanation: "“Than” introduces the comparison. “Then” describes time or sequence." },
        { id: "en-reason", title: "Give a reason", pattern: "because + clause", description: "Follow “because” with a subject and a verb to explain why.", example: "We saved the example because it was useful.", pronunciation: "", translation: "Uložili sme príklad, pretože bol užitočný.", prompt: "Complete: I review my words ___ I want to remember them.", options: ["because", "during", "despite"], answer: "because", explanation: "“Because” connects the action to the reason expressed by the next clause." }
      ]
    }
  };
})();
