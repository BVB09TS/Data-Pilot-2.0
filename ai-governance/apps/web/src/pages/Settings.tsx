import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi } from '../lib/api';

interface SettingsForm {
  groq_api_key: string;
  openai_api_key: string;
  anthropic_api_key: string;
  default_project_path: string;
}

export default function Settings() {
  const { workspaceId } = useAuth();

  const [form, setForm] = useState<SettingsForm>({
    groq_api_key: '',
    openai_api_key: '',
    anthropic_api_key: '',
    default_project_path: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Masked values from server (shown as placeholder when field is blank)
  const [masked, setMasked] = useState<Partial<SettingsForm>>({});

  useEffect(() => {
    if (!workspaceId) return;
    settingsApi.get(workspaceId)
      .then(r => {
        const d = r.data;
        setMasked({
          groq_api_key: d.groq_api_key ?? '',
          openai_api_key: d.openai_api_key ?? '',
          anthropic_api_key: d.anthropic_api_key ?? '',
          default_project_path: d.default_project_path ?? '',
        });
        setForm(f => ({
          ...f,
          default_project_path: d.default_project_path ?? '',
        }));
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  function set(field: keyof SettingsForm, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setSavedMsg('');
    setErrorMsg('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');

    // Only send fields that were explicitly edited (non-empty string = user typed something)
    const body: Record<string, string> = {};
    if (form.groq_api_key.trim())         body.groq_api_key         = form.groq_api_key.trim();
    if (form.openai_api_key.trim())       body.openai_api_key       = form.openai_api_key.trim();
    if (form.anthropic_api_key.trim())    body.anthropic_api_key    = form.anthropic_api_key.trim();
    // Always send project path (even if empty, to allow clearing it)
    body.default_project_path = form.default_project_path.trim();

    try {
      await settingsApi.update(workspaceId, body);
      setSavedMsg('Settings saved.');
      // Re-fetch to show updated masked values
      const r = await settingsApi.get(workspaceId);
      const d = r.data;
      setMasked({
        groq_api_key: d.groq_api_key ?? '',
        openai_api_key: d.openai_api_key ?? '',
        anthropic_api_key: d.anthropic_api_key ?? '',
        default_project_path: d.default_project_path ?? '',
      });
      // Clear key fields (don't keep plaintext in state after save)
      setForm(f => ({ ...f, groq_api_key: '', openai_api_key: '', anthropic_api_key: '' }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure LLM API keys and default project path for this workspace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* LLM API Keys */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <p className="text-sm font-semibold text-white">LLM API Keys</p>
          <p className="text-xs text-gray-500">
            Keys are stored securely and shown masked after saving. Leave a field blank to keep the existing value.
            Enter a new value to replace it.
          </p>

          <KeyField
            label="Groq API Key"
            id="groq_api_key"
            value={form.groq_api_key}
            placeholder={masked.groq_api_key ? `Current: ${masked.groq_api_key}` : 'gsk_…'}
            onChange={v => set('groq_api_key', v)}
            hint="Free tier — recommended as primary provider"
          />
          <KeyField
            label="OpenAI API Key"
            id="openai_api_key"
            value={form.openai_api_key}
            placeholder={masked.openai_api_key ? `Current: ${masked.openai_api_key}` : 'sk-…'}
            onChange={v => set('openai_api_key', v)}
            hint="Standard tier — GPT-4o-mini"
          />
          <KeyField
            label="Anthropic API Key"
            id="anthropic_api_key"
            value={form.anthropic_api_key}
            placeholder={masked.anthropic_api_key ? `Current: ${masked.anthropic_api_key}` : 'sk-ant-…'}
            onChange={v => set('anthropic_api_key', v)}
            hint="Premium tier — Claude (complex analysis)"
          />
        </div>

        {/* Default project path */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-white">Default Project Path</p>
          <p className="text-xs text-gray-500">
            Pre-fill the dbt project path when triggering audits from the Findings page.
          </p>
          <input
            id="default_project_path"
            type="text"
            value={form.default_project_path}
            onChange={e => set('default_project_path', e.target.value)}
            placeholder="/absolute/path/to/dbt/project"
            className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {savedMsg && <span className="text-sm text-green-400">{savedMsg}</span>}
          {errorMsg && <span className="text-sm text-red-400">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
}

function KeyField({
  label, id, value, placeholder, onChange, hint,
}: {
  label: string;
  id: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-300">{label}</label>
      <div className="flex gap-2">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="px-3 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition"
          title={show ? 'Hide' : 'Show'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}
