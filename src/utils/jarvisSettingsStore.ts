/**
 * Persist Jarvis OpenRouter key + model in Firestore under the signed-in user,
 * and mirror to localStorage for offline/fast reads.
 *
 * Path: users/{uid}/settings/jarvis
 * Fields: openRouterApiKey, llmModel, freeOnly, updatedAt
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';

export type JarvisCloudSettings = {
  openRouterApiKey: string;
  llmModel: string;
  freeOnly: boolean;
};

const LOCAL_KEY = 'bt_openrouter_api_key';
const LOCAL_MODEL = 'bt_llm_model';
const LOCAL_FREE = 'bt_llm_free_only';

function jarvisDocRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'jarvis');
}

export function readJarvisLocal(): JarvisCloudSettings {
  return {
    openRouterApiKey: (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_KEY)) || '',
    llmModel:
      (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_MODEL)) ||
      'anthropic/claude-3.5-sonnet',
    freeOnly:
      typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_FREE) === 'true',
  };
}

export function writeJarvisLocal(settings: Partial<JarvisCloudSettings>) {
  try {
    if (settings.openRouterApiKey !== undefined) {
      const v = (settings.openRouterApiKey || '').trim();
      if (v) localStorage.setItem(LOCAL_KEY, v);
      else localStorage.removeItem(LOCAL_KEY);
    }
    if (settings.llmModel !== undefined && settings.llmModel) {
      localStorage.setItem(LOCAL_MODEL, settings.llmModel);
    }
    if (settings.freeOnly !== undefined) {
      localStorage.setItem(LOCAL_FREE, String(settings.freeOnly));
    }
  } catch {
    // ignore quota
  }
  try {
    window.dispatchEvent(new Event('bt_jarvis_settings_changed'));
  } catch {
    // ignore
  }
}

/** Load from Firestore and hydrate localStorage. Falls back to local. */
export async function loadJarvisSettingsFromCloud(): Promise<JarvisCloudSettings> {
  const local = readJarvisLocal();
  const user = getCustomUser();
  if (!user?.uid) return local;

  try {
    const snap = await getDoc(jarvisDocRef(user.uid));
    if (!snap.exists()) {
      if (local.openRouterApiKey) {
        await saveJarvisSettingsToCloud(local);
      }
      return local;
    }
    const data = snap.data() || {};
    const cloud: JarvisCloudSettings = {
      openRouterApiKey: String(data.openRouterApiKey || '').trim(),
      llmModel: String(data.llmModel || local.llmModel || 'anthropic/claude-3.5-sonnet'),
      freeOnly: data.freeOnly === true,
    };
    const merged: JarvisCloudSettings = {
      openRouterApiKey: cloud.openRouterApiKey || local.openRouterApiKey,
      llmModel: cloud.llmModel || local.llmModel,
      freeOnly: cloud.openRouterApiKey ? cloud.freeOnly : local.freeOnly,
    };
    writeJarvisLocal(merged);
    return merged;
  } catch (e) {
    console.warn('Jarvis settings cloud load failed, using local', e);
    return local;
  }
}

/** Save to Firestore + localStorage. */
export async function saveJarvisSettingsToCloud(
  settings: Partial<JarvisCloudSettings>
): Promise<void> {
  const current = { ...readJarvisLocal(), ...settings };
  writeJarvisLocal(current);

  const user = getCustomUser();
  if (!user?.uid) return;

  try {
    await setDoc(
      jarvisDocRef(user.uid),
      {
        openRouterApiKey: (current.openRouterApiKey || '').trim(),
        llmModel: current.llmModel || 'anthropic/claude-3.5-sonnet',
        freeOnly: !!current.freeOnly,
        updatedAt: new Date().toISOString(),
        email: user.email || null,
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Jarvis settings cloud save failed (kept local)', e);
    throw e;
  }
}
