import React, { useState } from 'react';
import { Button, Typography, message } from 'antd';
import { FileAddOutlined, LinkOutlined, ReloadOutlined, LogoutOutlined } from '@ant-design/icons';
import { dove, MsgType } from '../../utils/dove';
import './index.less';

const { Title, Text } = Typography;

interface ConfigProps {
  onDone: () => void;
  onLogout: () => void;
}

const configExample = `[
  {
    "projectId": 8655,
    "token": "c766bcbc3f8f31ae57701c9a46311afc7cd0f2103909e071dbf72319a8d2c0f3"
  }
]`;

const Config: React.FC<ConfigProps> = ({ onDone, onLogout }) => {
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleCreateConfig() {
    setCreating(true);
    try {
      const result = await dove.sendMessage<{ success: boolean; path?: string }>(
        MsgType.CREATE_YTT_CONFIG
      );
      if (result.success) {
        message.success('配置文件已创建');
      } else {
        message.error('创建失败，请确认已打开工作区');
      }
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenYapi() {
    const config = await dove.sendMessage<{ value: string }>(MsgType.GET_STORAGE, {
      key: 'yapi2code.serverUrl',
    });
    const url = config?.value || 'https://yapi.example.com';
    await dove.sendMessage(MsgType.OPEN_EXTERNAL_LINK, { url });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      onDone();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await dove.sendMessage(MsgType.LOGOUT);
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="config-container">
      <div className="config-header">
        <div className="config-header-top">
          <Title level={4} style={{ color: 'var(--vscode-foreground)', margin: 0 }}>
            API 管理工具初始化
          </Title>
          <Button
            className="logout-btn"
            type="text"
            icon={<LogoutOutlined />}
            loading={loggingOut}
            onClick={handleLogout}
            size="small"
          >
            退出登录
          </Button>
        </div>
        <Text type="secondary">只需三步即可完成配置</Text>
      </div>

      <div className="config-steps">
        {/* Step 1 */}
        <div className="step-item">
          <div className="step-number">1</div>
          <div className="step-content">
            <div className="step-title">自动创建配置文件</div>
            <Text type="secondary" className="step-desc">
              系统将自动为您生成 <code>ytt.json</code> 模板文件
            </Text>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              loading={creating}
              onClick={handleCreateConfig}
              style={{ marginTop: 12 }}
            >
              自动创建配置
            </Button>
          </div>
        </div>

        {/* Example */}
        <div className="config-example">
          <div className="example-header">
            <Text strong style={{ color: 'var(--vscode-foreground)' }}>
              ytt.json 文件示例
            </Text>
          </div>
          <pre className="example-code">{configExample}</pre>
        </div>

        {/* Step 2 */}
        <div className="step-item">
          <div className="step-number">2</div>
          <div className="step-content">
            <div className="step-title">手动获取项目信息</div>
            <Text type="secondary" className="step-desc">
              需要前往 YAPI 平台复制 <strong>项目 ID</strong> 和 <strong>Token</strong>
            </Text>
            <Button
              icon={<LinkOutlined />}
              onClick={handleOpenYapi}
              style={{ marginTop: 12 }}
            >
              前往 YAPI 平台复制
            </Button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="step-item">
          <div className="step-number">3</div>
          <div className="step-content">
            <div className="step-title">刷新配置文件</div>
            <Text type="secondary" className="step-desc">
              修改配置后点击刷新配置
            </Text>
            <Button
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={handleRefresh}
              style={{ marginTop: 12 }}
            >
              刷新配置
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Config;
