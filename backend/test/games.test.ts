import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStaticRounds, isHotLevel, minHotLevel, HOT_LEVEL_ORDER, DEFAULT_HOT_LEVEL, HOT_MOOD } from '../src/services/games';

describe('games service - pure functions', () => {
  describe('isHotLevel', () => {
    it('returns true for valid hot levels', () => {
      assert.equal(isHotLevel('flirt'), true);
      assert.equal(isHotLevel('warm'), true);
      assert.equal(isHotLevel('bold'), true);
      assert.equal(isHotLevel('wild'), true);
    });

    it('returns false for invalid values', () => {
      assert.equal(isHotLevel('invalid'), false);
      assert.equal(isHotLevel('hot'), false);
      assert.equal(isHotLevel(null), false);
      assert.equal(isHotLevel(undefined), false);
      assert.equal(isHotLevel(123), false);
    });
  });

  describe('minHotLevel', () => {
    it('returns the lower level', () => {
      assert.equal(minHotLevel('flirt', 'warm'), 'flirt');
      assert.equal(minHotLevel('warm', 'bold'), 'warm');
      assert.equal(minHotLevel('bold', 'wild'), 'bold');
      assert.equal(minHotLevel('wild', 'flirt'), 'flirt');
    });

    it('returns the same level when equal', () => {
      assert.equal(minHotLevel('warm', 'warm'), 'warm');
    });
  });

  describe('HOT_LEVEL_ORDER and DEFAULT_HOT_LEVEL', () => {
    it('has correct order', () => {
      assert.deepEqual(HOT_LEVEL_ORDER, ['flirt', 'warm', 'bold', 'wild']);
    });

    it('DEFAULT_HOT_LEVEL is warm', () => {
      assert.equal(DEFAULT_HOT_LEVEL, 'warm');
    });
  });

  describe('HOT_MOOD constant', () => {
    it('is defined as погорячее 18+', () => {
      assert.equal(HOT_MOOD, 'погорячее 18+');
    });
  });

  describe('buildStaticRounds with HOT_MOOD', () => {
    const games = [
      { id: 'ASSOCIATIONS', expectedRounds: 8 },
      { id: 'COMPLIMENTS', expectedRounds: 6 },
      { id: 'SPEED_FACTS', expectedRounds: 8 },
      { id: 'TRUTH_DARE', expectedRounds: 6 },
    ];

    for (const { id, expectedRounds } of games) {
      it(`returns ${expectedRounds} rounds for ${id} with HOT_MOOD`, () => {
        const rounds = buildStaticRounds(id as any, HOT_MOOD, DEFAULT_HOT_LEVEL);
        assert.equal(rounds.length, expectedRounds);
        if (id === 'TRUTH_DARE') {
          // TRUTH_DARE rounds have empty text (questions in truth/dare fields)
          assert.ok(rounds.every(r => r.truth && r.dare && r.truthB && r.dareB));
        } else {
          assert.ok(rounds.every(r => r.text && r.options));
        }
      });
    }
  });

  describe('rampUp progression for ASSOCIATIONS', () => {
    it('at flirt level uses only flirt bank', () => {
      const rounds = buildStaticRounds('ASSOCIATIONS', HOT_MOOD, 'flirt');
      assert.equal(rounds.length, 8);
      const flirtWords = ['Шёпот', 'Взгляд', 'Искра', 'Мурашки', 'Касание', 'Духи', 'Румянец', 'Томность'];
      for (const r of rounds) {
        assert.ok(flirtWords.includes(r.text));
      }
    });

    it('at wild level has 2 words per level in order', () => {
      const rounds = buildStaticRounds('ASSOCIATIONS', HOT_MOOD, 'wild');
      assert.equal(rounds.length, 8);
      const allWords = rounds.map(r => r.text);
      const flirtWords = ['Шёпот', 'Взгляд', 'Искра', 'Мурашки', 'Касание', 'Духи', 'Румянец', 'Томность'];
      const warmWords = ['Шёлк', 'Губы', 'Жара', 'Полночь', 'Дыхание', 'Ключица', 'Дрожь', 'Магнит'];
      const boldWords = ['Кожа', 'Пульс', 'Горячий душ', 'Тёмная комната', 'Нетерпение', 'Запретное', 'Поцелуи до утра', 'Объятия без слов'];
      const wildWords = ['Повязка на глазах', 'Шёлковый шарф', 'Игра без правил', 'Передать контроль', 'Страсть', 'Ненасытность', 'Запретный плод', 'Стоп-слово'];

      let flirtCount = 0, warmCount = 0, boldCount = 0, wildCount = 0;
      for (const w of allWords) {
        if (flirtWords.includes(w)) flirtCount++;
        else if (warmWords.includes(w)) warmCount++;
        else if (boldWords.includes(w)) boldCount++;
        else if (wildWords.includes(w)) wildCount++;
      }
      assert.equal(flirtCount, 2);
      assert.equal(warmCount, 2);
      assert.equal(boldCount, 2);
      assert.equal(wildCount, 2);
    });

    it('order respects level progression (flirt before warm before bold before wild)', () => {
      const rounds = buildStaticRounds('ASSOCIATIONS', HOT_MOOD, 'wild');
      const levels = rounds.map(r => {
        const text = r.text;
        if (['Шёпот', 'Взгляд', 'Искра', 'Мурашки', 'Касание', 'Духи', 'Румянец', 'Томность'].includes(text)) return 0;
        if (['Шёлк', 'Губы', 'Жара', 'Полночь', 'Дыхание', 'Ключица', 'Дрожь', 'Магнит'].includes(text)) return 1;
        if (['Кожа', 'Пульс', 'Горячий душ', 'Тёмная комната', 'Нетерпение', 'Запретное', 'Поцелуи до утра', 'Объятия без слов'].includes(text)) return 2;
        if (['Повязка на глазах', 'Шёлковый шарф', 'Игра без правил', 'Передать контроль', 'Страсть', 'Ненасытность', 'Запретный плод', 'Стоп-слово'].includes(text)) return 3;
        return -1;
      });
      for (let i = 1; i < levels.length; i++) {
        assert.ok(levels[i] >= levels[i - 1]);
      }
    });
  });

  describe('COMPLIMENTS boundary opener', () => {
    it('includes HOT_BOUNDARY_OPENER for bold and wild', () => {
      const roundsBold = buildStaticRounds('COMPLIMENTS', HOT_MOOD, 'bold');
      const roundsWild = buildStaticRounds('COMPLIMENTS', HOT_MOOD, 'wild');
      assert.equal(roundsBold[0].text, 'Что мне важно знать о твоих границах, чтобы тебе было спокойно?');
      assert.equal(roundsWild[0].text, 'Что мне важно знать о твоих границах, чтобы тебе было спокойно?');
      assert.equal(roundsBold.length, 6);
      assert.equal(roundsWild.length, 6);
    });

    it('does not include HOT_BOUNDARY_OPENER for flirt and warm', () => {
      const roundsFlirt = buildStaticRounds('COMPLIMENTS', HOT_MOOD, 'flirt');
      const roundsWarm = buildStaticRounds('COMPLIMENTS', HOT_MOOD, 'warm');
      assert.notEqual(roundsFlirt[0].text, 'Что мне важно знать о твоих границах, чтобы тебе было спокойно?');
      assert.notEqual(roundsWarm[0].text, 'Что мне важно знать о твоих границах, чтобы тебе было спокойно?');
      assert.equal(roundsFlirt.length, 6);
      assert.equal(roundsWarm.length, 6);
    });
  });

  describe('DEFAULT_HOT_LEVEL (warm) behavior', () => {
    it('for ASSOCIATIONS at warm uses only flirt and warm', () => {
      const rounds = buildStaticRounds('ASSOCIATIONS', HOT_MOOD, DEFAULT_HOT_LEVEL);
      const allWords = rounds.map(r => r.text);
      const flirtWords = ['Шёпот', 'Взгляд', 'Искра', 'Мурашки', 'Касание', 'Духи', 'Румянец', 'Томность'];
      const warmWords = ['Шёлк', 'Губы', 'Жара', 'Полночь', 'Дыхание', 'Ключица', 'Дрожь', 'Магнит'];
      const boldWords = ['Кожа', 'Пульс', 'Горячий душ', 'Тёмная комната', 'Нетерпение', 'Запретное', 'Поцелуи до утра', 'Объятия без слов'];
      const wildWords = ['Повязка на глазах', 'Шёлковый шарф', 'Игра без правил', 'Передать контроль', 'Страсть', 'Ненасытность', 'Запретный плод', 'Стоп-слово'];

      for (const w of allWords) {
        assert.ok(flirtWords.concat(warmWords).includes(w));
        assert.ok(!boldWords.includes(w));
        assert.ok(!wildWords.includes(w));
      }
    });

    it('for SPEED_FACTS at warm uses only flirt and warm', () => {
      const rounds = buildStaticRounds('SPEED_FACTS', HOT_MOOD, DEFAULT_HOT_LEVEL);
      const allTexts = rounds.map(r => r.text);
      const flirtFacts = [
        'Мы флиртуем друг с другом даже при посторонних',
        'Мы можем часами обниматься и не замечать времени',
        'Мы знаем, какой взгляд значит «пойдём отсюда»',
        'Мы любим целоваться без повода',
        'Мы переписывались так, что приходилось отводить глаза от экрана',
        'Мы краснеем от одного прикосновения',
        'Нам нравится дразнить друг друга намёками',
        'Мы целуемся дольше, чем собирались',
      ];
      const warmFacts = [
        'Мы знаем, какие прикосновения действуют на нас сильнее всего',
        'Мы шепчем друг другу то, что не скажем при друзьях',
        'Мы однажды не дошли до спальни',
        'Нам хватает одного прикосновения, чтобы всё остальное перестало быть важным',
        'Мы умеем завести друг друга одним сообщением',
        'Наши поцелуи часто заходят дальше задуманного',
        'Мы засыпаем в объятиях чаще, чем по отдельности',
        'Нам трудно держать руки при себе, когда мы вдвоём',
      ];
      const boldFacts = [
        'Мы уже обсуждали вслух, чего хотим в близости',
        'Мы можем долго не вылезать из постели по выходным',
        'Мы пробовали что-то новое только потому, что партнёру было любопытно',
        'Мы можем сказать «медленнее» или «смелее» и не обидеться',
        'Мы отправляли друг другу намёки, от которых невозможно было сосредоточиться',
        'Мы любим, когда близость начинается внезапно',
        'Мы не стесняемся говорить, что нам нравится',
        'Мы знаем, что заводит нас ещё до того, как мы остаёмся вдвоём',
      ];

      for (const t of allTexts) {
        assert.ok(flirtFacts.concat(warmFacts).includes(t));
        assert.ok(!boldFacts.includes(t));
      }
    });
  });

  describe('Other moods still work', () => {
    const moods = ['нежное', 'веселое', 'погорячее', 'поговорить', 'спокойное'] as const;
    const games = ['ASSOCIATIONS', 'COMPLIMENTS', 'SPEED_FACTS', 'TRUTH_DARE'] as const;

    for (const mood of moods) {
      for (const game of games) {
        it(`returns rounds for ${game} with mood ${mood}`, () => {
          const rounds = buildStaticRounds(game as any, mood);
          assert.ok(rounds.length > 0);
          if (game === 'TRUTH_DARE') {
            assert.ok(rounds.every(r => r.truth && r.dare && r.truthB && r.dareB));
          } else {
            assert.ok(rounds.every(r => r.text && r.options));
          }
        });
      }
    }
  });
});