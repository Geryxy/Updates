import { t } from '../i18n';
import { APP_VERSION, isTauri, native } from '../platform/Platform';
import { WINDOW_SIZES } from '../storage/Settings';
import { btn } from './dom';
import { actions, modals } from './registry';

let savesPath = '';

/** Beállítások: a launcher és a játék ugyanazokat az értékeket használja. */
modals.settings = {
  render(app, data) {
    const st = app.settings;
    const slider = (key: 'music' | 'sfx') => `<label class="field"><span>${t(`set.${key}`)}</span>
      <input type="range" min="0" max="100" value="${Math.round(st[key] * 100)}" data-input="settings" data-arg="${key}"><b>${Math.round(st[key] * 100)}%</b></label>`;
    const opt = (v: string, cur: string, label: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
    if (isTauri && !savesPath) void native<string>('saves_path').then(p => { savesPath = p; app.ui.render(); }).catch(() => undefined);
    return `<h2>${t('ui.settings')}</h2>
      ${slider('music')}${slider('sfx')}
      <label class="field"><span>${t('set.mute')}</span><input type="checkbox" data-input="settings" data-arg="muted"${st.muted ? ' checked' : ''}></label>
      <label class="field"><span>${t('set.quality')}</span><select data-input="settings" data-arg="quality">
        ${opt('low', st.quality, t('set.quality.low'))}${opt('medium', st.quality, t('set.quality.medium'))}${opt('high', st.quality, t('set.quality.high'))}</select></label>
      ${isTauri ? `<label class="field"><span>${t('set.fullscreen')}</span><input type="checkbox" data-input="settings" data-arg="fullscreen"${st.fullscreen ? ' checked' : ''}></label>
        <label class="field"><span>${t('set.windowSize')}</span><select data-input="settings" data-arg="windowSize">${WINDOW_SIZES.map(w => opt(w, st.windowSize, w.replace('x', ' × '))).join('')}</select></label>
        <div class="field"><span>${t('set.saves')}</span><small class="path">${savesPath}</small></div>
        <div class="actions">${btn(t('set.openSaves'), 'settings:openSaves')}</div>` : `<p class="hint">${t('set.webSaves')}</p>`}
      <p class="hint">${t('set.version', { v: APP_VERSION })}</p>
      <div class="actions">${btn(t('ui.help'), 'open', { arg: 'help' })}${btn(t('ui.back'), data.back ? 'open' : 'modal:close', { arg: String(data.back ?? ''), cls: 'primary' })}</div>`;
  },
};

actions['settings:openSaves'] = () => { void native('open_saves_dir').catch(() => undefined); };

/** A csúszkák és kapcsolók változását a UI az `input` eseményből továbbítja ide. */
export function settingsInput(app: import('../app/GameApp').GameApp, key: string, el: HTMLInputElement | HTMLSelectElement) {
  if (key === 'music' || key === 'sfx') {
    const v = Number(el.value) / 100;
    void app.updateSettings({ [key]: v });
    const out = el.parentElement?.querySelector('b');
    if (out) out.textContent = `${Math.round(v * 100)}%`;
  } else if (key === 'muted' || key === 'fullscreen') {
    void app.updateSettings({ [key]: (el as HTMLInputElement).checked });
  } else if (key === 'quality') {
    void app.updateSettings({ quality: el.value as 'low' | 'medium' | 'high' });
  } else if (key === 'windowSize') {
    void app.updateSettings({ windowSize: el.value }).then(() => { if (isTauri) void native('set_window_size', { size: el.value }).catch(() => undefined); });
  }
}

modals.help = {
  render: (_app, data) => `<h2>${t('ui.help')}</h2>
    <h3>Windows</h3><ul class="help">${t('help.win').split('|').map(l => `<li>${l}</li>`).join('')}</ul>
    <h3>iPhone</h3><ul class="help">${t('help.touch').split('|').map(l => `<li>${l}</li>`).join('')}</ul>
    <h3>${t('help.goalTitle')}</h3><ul class="help">${t('help.goal').split('|').map(l => `<li>${l}</li>`).join('')}</ul>
    <div class="actions">${btn(t('ui.back'), data.back ? 'open' : 'modal:close', { arg: String(data.back ?? ''), cls: 'primary' })}</div>`,
};
