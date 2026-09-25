import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBotReply, stripCommand } from '../src/services/botCommands';

test('bot: every command resolves to a non-empty reply', () => {
  const commands = ['start', 'help', 'valentine', 'pairing', 'profile', 'streak', 'games', 'about', 'feedback'];
  for (const command of commands) {
    const reply = resolveBotReply(command);
    assert.ok(reply.text.length > 0, `${command} must have a text reply`);
  }
});

test('bot: unknown command falls back to the help hint', () => {
  const hint = 'Не знаю такую команду';
  assert.ok(resolveBotReply('definitely-not-a-command').text.startsWith(hint));
  // /menu is a real app feature but was NOT enabled as a bot command yet.
  assert.ok(resolveBotReply('menu').text.startsWith(hint));
});

test('bot: command with bot username suffix still resolves', () => {
  assert.equal(stripCommand('/start@pairvalentine_bot'), 'start');
  assert.equal(stripCommand('/help'), 'help');
  assert.ok(resolveBotReply('/start@pairvalentine_bot').text.startsWith('Привет'));
});

test('bot: start/about/games open the mini app via a web_app button', () => {
  for (const command of ['start', 'about', 'games', 'valentine', 'pairing', 'profile', 'streak']) {
    const reply = resolveBotReply(command);
    assert.ok(reply.buttons && reply.buttons.length > 0, `${command} should offer a mini app button`);
  }
});

test('bot: message without a slash is ignored by the handler resolution', () => {
  // handleBotText ignores non-command text; resolveBotReply is only for commands.
  assert.ok(resolveBotReply('').text.startsWith('Не знаю такую команду'));
});