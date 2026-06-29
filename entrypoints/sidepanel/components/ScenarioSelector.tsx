import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { sendToBackground } from '../../../core/messaging';
import { getAgentScenario, saveAgentScenario } from '../../../core/prompt/scenario-store';
import { getGroupsForScenario } from '../../../core/prompt/scenario';
import { createShellMcpPresetInput } from '../../../core/shell';
import type { AgentScenario } from '../../../core/prompt/types';

const SCENARIOS: AgentScenario[] = ['chat', 'coding', 'browsing', 'automation'];

const SCENARIO_NAMES: Record<AgentScenario, string> = {
  chat: '日常对话',
  coding: '编程开发',
  browsing: '浏览器控制',
  automation: '自动任务',
};

const SCENARIO_ICONS: Record<AgentScenario, string> = {
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  coding: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  browsing: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  automation: 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
};

const TOOL_GROUP_NAMES: Record<string, string> = {
  memory: '记忆', web: '搜索', artifact: '产物', sandbox: '沙箱',
  shell: 'Shell', file: '文件', code: '代码', git: 'Git',
  browser: '浏览器', mcp: 'MCP',
};

/** 只要安装了 Shell MCP，file、git、shell 工具组就可用 */
const MCP_SHELL_HOST = 'com.deepseek_pp.shell';

export default function ScenarioSelector() {
  const { t } = useI18n();
  const [scenario, setScenario] = useState<AgentScenario | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasShell, setHasShell] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState('');

  const refreshStatus = useCallback(async () => {
    const servers: unknown = await chrome.runtime.sendMessage({ type: 'GET_MCP_SERVERS' }).catch(() => []);
    if (Array.isArray(servers)) {
      setHasShell(servers.some((s: Record<string, unknown>) => s.id === MCP_SHELL_HOST && s.enabled === true));
    }
  }, []);

  useEffect(() => { getAgentScenario().then(setScenario); }, []);
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const handleChange = async (newScenario: AgentScenario) => {
    if (newScenario === scenario) return;
    setSaving(true);
    setScenario(newScenario);
    try {
      await saveAgentScenario(newScenario);
      await sendToBackground({ type: 'SCENARIO_CHANGED', payload: { scenario: newScenario } });
    } catch {
      setScenario(await getAgentScenario());
    } finally {
      setSaving(false);
    }
  };

  const oneClickInstall = async () => {
    setInstalling(true);
    setInstallMsg('');
    try {
      await chrome.runtime.sendMessage({
        type: 'CREATE_MCP_SERVER',
        payload: createShellMcpPresetInput({ enabled: true }),
      });
      await refreshStatus();
      setInstallMsg('');
    } catch (e) {
      setInstallMsg(e instanceof Error ? e.message : '安装失败');
    } finally {
      setInstalling(false);
    }
  };

  if (!scenario) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sidepanel.scenarioSelector.title')}</h2>
        <p className="text-sm opacity-70">{t('sidepanel.scenarioSelector.loading')}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('sidepanel.scenarioSelector.title')}</h2>
      <p className="text-sm opacity-70">{t('sidepanel.scenarioSelector.description')}</p>

      <div className="space-y-2">
        {SCENARIOS.map(s => {
          const selected = s === scenario;
          const groups = getGroupsForScenario(s);
          return (
            <button key={s} type="button" disabled={saving} onClick={() => handleChange(s)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={selected}>
              <div className="flex items-start gap-3">
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? 'text-blue-500' : 'text-gray-400'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={SCENARIO_ICONS[s]} />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${selected ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                      {SCENARIO_NAMES[s]}
                    </span>
                    {selected && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                        {t('sidepanel.scenarioSelector.active')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                    {groups.map(g => (
                      <span key={g.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          selected
                            ? 'bg-blue-100/70 dark:bg-blue-800/40 text-blue-600 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                        {TOOL_GROUP_NAMES[g.id] || g.title}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`w-4 h-4 mt-1 rounded-full border-2 shrink-0 ${
                  selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selected && (
                    <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {scenario === 'coding' && (
        <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 space-y-2">
          <p className="text-sm font-medium">编程开发模式</p>
          {hasShell ? (
            <p className="text-xs text-green-600 dark:text-green-400">✓ Shell MCP 已就绪，可以直接使用文件、Git、Shell 等工具</p>
          ) : (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400">已内置代码搜索、文件读写、Git 操作等工具。需要一键启用本地 Shell 服务即可使用。</p>
              {installMsg && <p className="text-xs text-red-500">{installMsg}</p>}
              <button type="button" disabled={installing} onClick={oneClickInstall}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
                {installing ? '安装中...' : '一键启用本地 Shell'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
