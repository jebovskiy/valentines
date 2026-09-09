import { broadcastUpdatePush } from './pushDispatcher';

const GITHUB_REPO = process.env.GITHUB_REPO || 'jebovskiy/valentines';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let lastAnnouncedVersion: number | null = null;

interface ReleaseInfo {
  version_code: number;
  version_name: string;
}

async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'valentines-backend' },
    });
    if (!res.ok) return null;
    const release = (await res.json()) as { tag_name?: string };
    const versionCode = parseInt((release.tag_name || '').replace(/^v/, ''), 10);
    if (!Number.isFinite(versionCode)) return null;
    return { version_code: versionCode, version_name: release.tag_name || `v${versionCode}` };
  } catch (error) {
    console.error('Update broadcast: failed to fetch release:', error);
    return null;
  }
}

async function checkAndBroadcast(): Promise<void> {
  const release = await fetchLatestRelease();
  if (!release) return;

  // First successful check after startup just records the current version so
  // devices don't get bothered about an already-installed release.
  if (lastAnnouncedVersion === null) {
    lastAnnouncedVersion = release.version_code;
    return;
  }

  if (release.version_code > lastAnnouncedVersion) {
    lastAnnouncedVersion = release.version_code;
    await broadcastUpdatePush(release.version_name).catch((e) =>
      console.error('Update broadcast failed:', e),
    );
  }
}

export function startUpdateBroadcast(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void checkAndBroadcast();
  }, CHECK_INTERVAL_MS);

  // Run shortly after startup.
  setTimeout(() => {
    void checkAndBroadcast();
  }, 15_000);

  return timer;
}