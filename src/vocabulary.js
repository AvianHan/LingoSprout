(function (root) {
  "use strict";
  // Curated demonstration material, not model output or validated CEFR word labels.
  const languages = {
    en: { name: "English", nativeName: "English", locale: "en-GB", flag: "EN" },
    zh: { name: "Chinese", nativeName: "中文", locale: "zh-CN", flag: "ZH" },
    sk: { name: "Slovak", nativeName: "Slovenčina", locale: "sk-SK", flag: "SK" },
    th: { name: "Thai", nativeName: "ไทย", locale: "th-TH", flag: "TH" }
  };
  const en = [
    ["bank", "银行", "financial-institution", "A2", "yín háng", "A financial institution; here the loan makes the intended meaning clear.", "career", 110, "The bank approved her loan.", "这家银行批准了她的贷款。"],
    ["bank", "河岸", "river-edge", "A2", "hé àn", "The land beside a river, not a financial institution.", "interest", 110, "They sat on the river bank.", "他们坐在河岸边。"],
    ["loan", "贷款", "borrowed-money", "B1", "dài kuǎn", "Money borrowed under an agreement to repay it.", "career", 95, "The project received a small loan.", "这个项目获得了一笔小额贷款。"],
    ["community", "社区", "local-community", "A2", "shè qū", "People who live in or belong to a shared local area.", "settlement", 82, "The community supports the workshop.", "社区支持这个工作坊。"],
    ["skills", "技能", "practical-abilities", "B1", "jì néng", "Abilities developed through learning and practice.", "career", 90, "Residents learn practical skills.", "居民学习实用技能。"],
    ["opportunity", "机会", "favourable-chance", "B1", "jī huì", "A chance to do something useful or desirable.", "career", 85, "It is an opportunity to learn.", "这是一个学习的机会。"],
    ["privacy", "隐私", "personal-information-privacy", "B1", "yǐn sī", "Control over personal information and private matters.", "career", 84, "The project respects everyone's privacy.", "这个项目尊重每个人的隐私。"],
    ["learning", "学习", "acquiring-knowledge", "A1", "xué xí", "The activity of gaining knowledge or a skill.", "exam", 74, "Learning takes time and practice.", "学习需要时间和练习。"],
    ["future", "未来", "time-ahead", "A2", "wèi lái", "The time that is still to come.", "career", 63, "Its future depends on the people.", "它的未来取决于人们。"],
    ["challenge", "挑战", "difficult-task", "B1", "tiǎo zhàn", "A demanding task that requires effort.", "exam", 77, "Every challenge is a chance to learn.", "每个挑战都是学习的机会。"],
    ["environment", "环境", "surroundings", "B1", "huán jìng", "The surroundings and conditions in which people live.", "interest", 73, "We can improve the environment.", "我们可以改善环境。"],
    ["improve", "改善", "make-better", "A2", "gǎi shàn", "To make a situation or condition better.", "career", 67, "Volunteers improve the neighbourhood.", "志愿者改善社区环境。"],
    ["confidence", "信心", "belief-in-ability", "B1", "xìn xīn", "Belief in one's ability to do something.", "career", 70, "Practice builds confidence.", "练习增强信心。"],
    ["residents", "居民", "local-inhabitants", "A2", "jū mín", "People who live in a particular place.", "settlement", 70, "Residents share their ideas.", "居民分享他们的想法。"],
    ["workshop", "工作坊", "shared-practice-space", "B1", "gōng zuò fāng", "A place or session for practical work and learning.", "career", 65, "The workshop welcomes everyone.", "工作坊欢迎所有人。"],
    ["ideas", "想法", "thoughts-or-plans", "A1", "xiǎng fǎ", "Thoughts or plans about something.", "interest", 50, "People exchange ideas.", "人们交流想法。"],
    ["people", "人们", "persons", "A1", "rén men", "More than one person, considered together.", "settlement", 45, "People help each other.", "人们互相帮助。"],
    ["city", "城市", "urban-place", "A1", "chéng shì", "A large place where many people live and work.", "settlement", 42, "The city has a new library.", "这座城市有一座新图书馆。"],
    ["question", "问题", "inquiry", "A1", "wèn tí", "Something asked to obtain information.", "exam", 43, "We begin with a question.", "我们从一个问题开始。"],
    ["trees", "树木", "woody-plants", "A1", "shù mù", "Large plants with a trunk and branches.", "interest", 50, "Volunteers planted trees.", "志愿者种了树。"],
    ["evidence", "证据", "supporting-information", "B2", "zhèng jù", "Information that supports a claim or conclusion.", "exam", 88, "We need evidence before reaching a conclusion.", "我们需要证据才能得出结论。"],
    ["collaboration", "协作", "working-together", "B2", "xié zuò", "Working together towards a shared purpose.", "career", 87, "Collaboration makes the project possible.", "协作使这个项目成为可能。"],
    ["resilience", "韧性", "ability-to-recover", "C1", "rèn xìng", "The capacity to recover after difficulty.", "interest", 87, "The community showed resilience.", "社区展现了韧性。"],
    ["interdependence", "相互依存", "mutual-dependence", "C2", "xiāng hù yī cún", "The condition of depending on one another.", "exam", 86, "The project illustrates interdependence.", "这个项目体现了相互依存。"]
  ];
  const vocabulary = en.map(([source, target, sense, level, pronunciation, meaning, goal, priority, demoContext, example]) => ({
    source, target, sense, level, pronunciation, meaning, goals: [goal], priority,
    sourceLanguage: "en", targetLanguage: "zh", language: "zh", demoContext, example,
    translations: { zh: target }
  }));
  const supporting = [
    ["sk", "en", "komunita", "community", "local-community", "A2", "A group of people connected by a place or purpose.", "Miestna komunita vytvorila nový projekt.", "The local community created a new project."],
    ["sk", "en", "projekt", "project", "planned-work", "A2", "A planned piece of work with a shared aim.", "Tento projekt podporuje učenie.", "This project supports learning."],
    ["sk", "en", "učenie", "learning", "acquiring-knowledge", "A1", "Gaining knowledge or a skill.", "Učenie otvára nové možnosti.", "Learning opens new possibilities."],
    ["sk", "en", "mesto", "city", "urban-place", "A1", "A large place where people live and work.", "Naše mesto má novú knižnicu.", "Our city has a new library."],
    ["sk", "en", "budúcnosť", "future", "time-ahead", "A2", "The time still to come.", "Budúcnosť závisí od spolupráce.", "The future depends on cooperation."],
    ["sk", "en", "zručnosti", "skills", "practical-abilities", "B1", "Abilities developed through practice.", "Ľudia získavajú praktické zručnosti.", "People develop practical skills."],
    ["th", "zh", "ชุมชน", "社区", "local-community", "A2", "A local community of people.", "ชุมชนของเรามีพื้นที่สำหรับการเรียนรู้", "我们的社区有学习空间。"],
    ["th", "zh", "การเรียนรู้", "学习", "acquiring-knowledge", "A1", "The process of learning.", "การเรียนรู้เปิดโอกาสใหม่", "学习带来新机会。"],
    ["th", "zh", "โอกาส", "机会", "favourable-chance", "B1", "A chance to do something.", "ทุกคนมีโอกาสเรียนรู้", "每个人都有学习的机会。"],
    ["th", "zh", "ทักษะ", "技能", "practical-abilities", "B1", "Abilities developed through learning.", "เราฝึกทักษะใหม่ร่วมกัน", "我们一起练习新技能。"],
    ["th", "zh", "อนาคต", "未来", "time-ahead", "A2", "The time ahead.", "อนาคตเริ่มต้นจากวันนี้", "未来从今天开始。"],
    ["th", "zh", "ความเป็นส่วนตัว", "隐私", "personal-information-privacy", "B1", "Personal privacy.", "เราควรเคารพความเป็นส่วนตัว", "我们应该尊重隐私。"]
  ];
  supporting.forEach(([sourceLanguage, targetLanguage, source, target, sense, level, meaning, demoContext, example]) => vocabulary.push({
    sourceLanguage, targetLanguage, language: targetLanguage, source, target, sense, level, meaning,
    pronunciation: targetLanguage === "zh" ? ({ "社区": "shè qū", "学习": "xué xí", "机会": "jī huì", "技能": "jì néng", "未来": "wèi lái", "隐私": "yǐn sī" }[target] || "") : "",
    demoContext, example, priority: 60, goals: ["interest", "settlement"], translations: { [targetLanguage]: target }
  }));
  root.LINGO_LANGUAGES = languages;
  root.LINGO_VOCABULARY = vocabulary;
  root.LINGO_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
})(typeof window !== "undefined" ? window : globalThis);
