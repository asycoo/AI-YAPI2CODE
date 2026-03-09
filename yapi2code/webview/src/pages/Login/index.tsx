import React, { useState, useEffect } from 'react';
import { Input, Button, Switch, Form, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, CloudServerOutlined } from '@ant-design/icons';
import { dove, MsgType } from '../../utils/dove';
import './index.less';

const { Title, Text } = Typography;

interface LoginProps {
  onSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isLdap, setIsLdap] = useState(true);

  useEffect(() => {
    loadSavedConfig();
  }, []);

  async function loadSavedConfig() {
    try {
      const config = await dove.sendMessage<{
        serverUrl: string;
        loginByLdap: boolean;
        email: string;
      }>(MsgType.INIT_CONFIG);
      if (config) {
        form.setFieldsValue({
          serverUrl: config.serverUrl || '',
          email: config.email || '',
        });
        setIsLdap(config.loginByLdap || false);
      }
    } catch {
      // ignore
    }
  }

  async function handleLogin() {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (values.serverUrl) {
        let url = values.serverUrl.trim();
        if (!/^https?:\/\//i.test(url)) {
          url = `http://${url}`;
        }
        await dove.sendMessage(MsgType.SERVER_URL, { url });
      }

      const msgType = isLdap ? MsgType.LOGIN_BY_LDAP : MsgType.LOGIN_NOW;
      const result = await dove.sendMessage<{ success: boolean; message?: string }>(msgType, {
        email: values.email,
        password: values.password,
      });

      if (result.success) {
        message.success('登录成功');
        onSuccess();
      } else {
        message.error(result.message || '登录失败');
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '登录异常');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <Title level={4} style={{ color: 'var(--vscode-foreground)', margin: 0 }}>
          YAPI to Code
        </Title>
        <Text type="secondary">连接 YAPI 平台，一键生成代码</Text>
      </div>

      <Form form={form} layout="vertical" className="login-form">
        <Form.Item
          name="serverUrl"
          label="服务器地址"
          rules={[{ required: true, message: '请输入 YAPI 服务器地址' }]}
        >
          <Input
            prefix={<CloudServerOutlined />}
            placeholder="yapi.example.com（可省略 http://）"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="用户名 / 邮箱"
          rules={[{ required: true, message: '请输入用户名或邮箱' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入用户名或邮箱" />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            onPressEnter={handleLogin}
          />
        </Form.Item>

        <Form.Item>
          <div className="login-options">
            <span>LDAP 登录</span>
            <Switch
              checked={isLdap}
              onChange={setIsLdap}
              size="small"
            />
          </div>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            block
            loading={loading}
            onClick={handleLogin}
          >
            {isLdap ? 'LDAP 登录' : '登录'}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default Login;
