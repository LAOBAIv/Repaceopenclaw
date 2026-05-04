import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { AgentManager } from './pages/AgentManager';
import AgentLibrary from './pages/AgentLibrary';
import { AgentCreate } from './pages/AgentCreate';
import { AgentConsole } from './pages/AgentConsole';
import { AgentKanban } from './pages/AgentKanban';
import { SkillSettings } from './pages/SkillSettings';
import { PluginSettings } from './pages/PluginSettings';
import { PlatformAssistant } from './pages/PlatformAssistant';
import { AuthPage } from './pages/AuthPage';
import { AdminPanel } from './pages/AdminPanel';
import { useAuthStore } from './stores/authStore';

// 路由守卫：未登录跳转到 /login
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 登录/注册页 */}
        <Route path="/login" element={<AuthPage />} />

        {/* 需要登录的页面 */}
        <Route element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<ProjectWorkspace />} />
          <Route path="/agents" element={<AgentManager />} />
          <Route path="/agent-library" element={<AgentLibrary />} />
          <Route path="/agent-create" element={<AgentCreate />} />
          <Route path="/console" element={<AgentConsole />} />
          <Route path="/kanban" element={<AgentKanban />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/skill-settings" element={<SkillSettings />} />
          <Route path="/plugin-settings" element={<PluginSettings />} />
          <Route path="/platform-assistant" element={<PlatformAssistant />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
