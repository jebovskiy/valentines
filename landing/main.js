// Tiny, dependency-free boot script: platform detection, channel labels and
// the APK link. Everything else on the page is plain HTML/CSS.
//
// Channel labels (Метки каналов). Advertise a channel-specific link and the
// landing forwards it to the bot as the Mini App start_param, so you can see
// where a pair came from:
//
//   https://valentines.app/?src=habr   -> t.me/pairvalentine_bot?startapp=src_habr
//   https://valentines.app/?src=vc
//   https://valentines.app/?src=reddit
//   https://valentines.app/?src=tg
//   https://valentines.app/?src=ads
//
// `utm_source` and `ref` are accepted as aliases; anything without a label
// falls back to `src_landing`.

(function () {
  var BOT = 'pairvalentine_bot';
  var APK = 'https://github.com/jebovskiy/valentines/releases/latest';
  var DEFAULT_SRC = 'landing';

  // Android gets the widget/APK block; everyone else sees the honest iPhone note.
  if (/Android/i.test(navigator.userAgent || '')) {
    document.documentElement.classList.add('is-android');
  }

  var params = new URLSearchParams(window.location.search);
  var raw = (
    params.get('src') ||
    params.get('utm_source') ||
    params.get('ref') ||
    ''
  ).toLowerCase();
  var match = raw.match(/[a-z0-9_-]{1,32}/);
  var src = (match && match[0]) || DEFAULT_SRC;

  var botUrl = 'https://t.me/' + BOT + '?startapp=src_' + encodeURIComponent(src);
  window.__valentinesSrc = src;

  var links = document.querySelectorAll('.js-bot-link');
  for (var i = 0; i < links.length; i++) links[i].setAttribute('href', botUrl);

  var apks = document.querySelectorAll('.js-apk-link');
  for (var j = 0; j < apks.length; j++) apks[j].setAttribute('href', APK);

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
