import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { AgentManager } from './pages/AgentManager';
import { AgentCreate } from './pages/AgentCreate';
import { AgentConsole } from './pages/AgentConsole';
import { AgentKanban } from './pages/AgentKanban';
import { SkillSettings } from './pages/SkillSettings';
import { PluginSettings } from './pages/PluginSettings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<ProjectWorkspace />} />
          <Route path="/agents" element={<AgentManager />} />
          <Route path="/agent-create" element={<AgentCreate />} />
          <Route path="/console" element={<AgentConsole />} />
          <Route path="/kanban" element={<AgentKanban />} />
          <Route path="/skill-settings" element={<SkillSettings />} />
          <Route path="/plugin-settings" element={<PluginSettings />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
