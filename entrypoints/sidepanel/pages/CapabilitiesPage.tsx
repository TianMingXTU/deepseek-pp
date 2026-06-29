import { lazy, useState } from 'react';
import AutomationPage from './AutomationPage';
import BrowserControlPage from './BrowserControlPage';
import McpPage from './McpPage';
import PresetPage from './PresetPage';
import SkillPage from './SkillPage';
import ToolsPage from './ToolsPage';
import { SubTabs } from '../components/settings/primitives';
import { useI18n } from '../i18n';

const ScenarioSelector = lazy(() => import('../components/ScenarioSelector'));

type CapabilitiesSubTab = 'skill' | 'mcp' | 'tools' | 'browser' | 'preset' | 'automation' | 'scenario';

const SUB_TABS: { key: CapabilitiesSubTab; labelKey: string }[] = [
  { key: 'skill', labelKey: 'sidepanel.capabilitiesPage.tabs.skill' },
  { key: 'mcp', labelKey: 'sidepanel.capabilitiesPage.tabs.mcp' },
  { key: 'tools', labelKey: 'sidepanel.capabilitiesPage.tabs.tools' },
  { key: 'scenario', labelKey: 'sidepanel.capabilitiesPage.tabs.scenario' },
  { key: 'browser', labelKey: 'sidepanel.capabilitiesPage.tabs.browser' },
  { key: 'preset', labelKey: 'sidepanel.capabilitiesPage.tabs.preset' },
  { key: 'automation', labelKey: 'sidepanel.capabilitiesPage.tabs.automation' },
];

export default function CapabilitiesPage() {
  const [sub, setSub] = useState<CapabilitiesSubTab>('skill');
  const { t } = useI18n();

  const label = (tab: { key: CapabilitiesSubTab; labelKey: string }) =>
    tab.labelKey.startsWith('sidepanel.') ? t(tab.labelKey as any) : tab.labelKey;

  return (
    <div className="flex flex-col h-full">
      <SubTabs
        tabs={SUB_TABS.map((tab) => ({ key: tab.key, label: label(tab) }))}
        value={sub}
        onChange={setSub}
        ariaLabel={t('sidepanel.capabilitiesPage.navLabel')}
      />

      <div className="flex-1 overflow-y-auto">
        {sub === 'skill' && <SkillPage />}
        {sub === 'mcp' && <McpPage />}
        {sub === 'tools' && <ToolsPage />}
        {sub === 'scenario' && <ScenarioSelector />}
        {sub === 'browser' && <BrowserControlPage />}
        {sub === 'preset' && <PresetPage />}
        {sub === 'automation' && <AutomationPage />}
      </div>
    </div>
  );
}
