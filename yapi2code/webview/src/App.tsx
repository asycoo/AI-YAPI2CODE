import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import { dove, MsgType, useDoveSubscribe } from './utils/dove';
import Login from './pages/Login';
import Config from './pages/Config';
import ApiTree from './pages/ApiTree';

type PageState = 'loading' | 'login' | 'config' | 'apiTree';

interface YttConfig {
  projectId: number;
  token: string;
}

const App: React.FC = () => {
  const [page, setPage] = useState<PageState>('loading');
  const [configs, setConfigs] = useState<YttConfig[]>([]);

  useEffect(() => {
    init();
  }, []);

  useDoveSubscribe(MsgType.REFRESH_CONFIG, async () => {
    await checkConfig();
  });

  useDoveSubscribe(MsgType.LOGOUT, () => {
    setPage('login');
  });

  async function init() {
    await dove.sendMessage(MsgType.WEBVIEW_READY);
    const status = await dove.sendMessage<{ loggedIn: boolean }>(MsgType.LOGIN_STATUS);
    if (!status.loggedIn) {
      setPage('login');
      return;
    }
    await checkConfig();
  }

  async function checkConfig() {
    const result = await dove.sendMessage<{ hasConfig: boolean; configs: YttConfig[] }>(
      MsgType.YAPI_CONFIG_DATA
    );
    if (result.hasConfig && result.configs.length > 0) {
      const validConfigs = result.configs.filter((c) => c.projectId && c.token);
      if (validConfigs.length > 0) {
        setConfigs(validConfigs);
        setPage('apiTree');
        return;
      }
    }
    setPage('config');
  }

  function handleLoginSuccess() {
    checkConfig();
  }

  function handleConfigDone() {
    checkConfig();
  }

  function handleLogout() {
    setPage('login');
  }

  function handleRefresh() {
    checkConfig();
  }

  if (page === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (page === 'login') {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  if (page === 'config') {
    return <Config onDone={handleConfigDone} onLogout={handleLogout} />;
  }

  return <ApiTree configs={configs} onLogout={handleLogout} onRefresh={handleRefresh} />;
};

export default App;
