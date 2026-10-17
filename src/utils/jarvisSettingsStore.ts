/**
 * Persist Jarvis OpenRouter key + model in Firestore under the signed-in user,
 * and mirror to localStorage for offline/fast reads.
 *
 * Primary path: users/{uid}/settings/jarvis
 * Fallback path: users/{uid} fields (jarvisOpenRouterApiKey, jarvisLlmModel, jarvisFreeOnly)
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

function userDocRef(uid: string) {
  return doc(db, 'users', uid);
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

function fromUserDoc(data: Record<string, unknown>, local: JarvisCloudSettings): JarvisCloudSettings | null {
  const key = String(
    data.jarvisOpenRouterApiKey || data.openRouterApiKey || ''
  ).trim();
  const model = String(data.jarvisLlmModel || data.llmModel || '').trim();
  if (!key && !model && data.jarvisFreeOnly === undefined && data.freeOnly === undefined) {
    return null;
  }
  return {
    openRouterApiKey: key || local.openRouterApiKey,
    llmModel: model || local.llmModel || 'anthropic/claude-3.5-sonnet',
    freeOnly: data.jarvisFreeOnly === true || data.freeOnly === true,
  };
}

/** Load from Firestore and hydrate localStorage. Falls back to local. */
export async function loadJarvisSettingsFromCloud(): Promise<JarvisCloudSettings> {
  const local = readJarvisLocal();
  const user = getCustomUser();
  if (!user?.uid) return local;

  try {
    // 1) settings/jarvis subdoc
    try {
      const snap = await getDoc(jarvisDocRef(user.uid));
      if (snap.exists()) {
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
      }
    } catch (e) {
      console.warn('Jarvis settings/jarvis load failed', e);
    }

    // 2) fields on users/{uid}
    try {
      const userSnap = await getDoc(userDocRef(user.uid));
      if (userSnap.exists()) {
        const fromUser = fromUserDoc(userSnap.data() || {}, local);
        if (fromUser) {
          writeJarvisLocal(fromUser);
          return fromUser;
        }
      }
    } catch (e) {
      console.warn('Jarvis user-doc load failed', e);
    }

    // Nothing in cloud yet — push local if we have a key
    if (local.openRouterApiKey) {
      try {
        await saveJarvisSettingsToCloud(local);
      } catch {
        /* keep local */
      }
    }
    return local;
  } catch (e) {
    console.warn('Jarvis settings cloud load failed, using local', e);
    return local;
  }
}

/** Save to Firestore + localStorage. Tries subdoc then user doc. */
export async function saveJarvisSettingsToCloud(
  settings: Partial<JarvisCloudSettings>
): Promise<void> {
  const current = { ...readJarvisLocal(), ...settings };
  writeJarvisLocal(current);

  const user = getCustomUser();
  if (!user?.uid) {
    // No signed-in custom user — local only is intentional
    return;
  }

  const payload = {
    openRouterApiKey: (current.openRouterApiKey || '').trim(),
    llmModel: current.llmModel || 'anthropic/claude-3.5-sonnet',
    freeOnly: !!current.freeOnly,
    updatedAt: new Date().toISOString(),
    email: user.email || null,
  };

  const userPayload = {
    jarvisOpenRouterApiKey: payload.openRouterApiKey,
    jarvisLlmModel: payload.llmModel,
    jarvisFreeOnly: payload.freeOnly,
    jarvisUpdatedAt: payload.updatedAt,
    email: user.email || null,
  };

  let lastErr: unknown = null;

  try {
    await setDoc(jarvisDocRef(user.uid), payload, { merge: true });
    // Also mirror onto user doc so older rules still work
    try {
      await setDoc(userDocRef(user.uid), userPayload, { merge: true });
    } catch {
      /* optional mirror */
    }
    return;
  } catch (e) {
    lastErr = e;
    console.warn('Jarvis settings/jarvis write failed, trying user doc', e);
  }

  try {
    await setDoc(userDocRef(user.uid), userPayload, { merge: true });
    return;
  } catch (e) {
    lastErr = e;
    console.warn('Jarvis user-doc write failed', e);
  }

  const msg =
    lastErr && typeof lastErr === 'object' && 'message' in lastErr
      ? String((lastErr as { message?: string }).message)
      : String(lastErr || 'Firestore write denied');
  const code =
    lastErr && typeof lastErr === 'object' && 'code' in lastErr
      ? String((lastErr as { code?: string }).code)
      : '';
  throw new Error(code ? `${code}: ${msg}` : msg);
}
