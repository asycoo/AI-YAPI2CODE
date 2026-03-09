import React, { useState, useEffect, useCallback } from 'react';
import { Input, Spin, Dropdown, message, Empty, Button, Checkbox } from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  LogoutOutlined,
  CopyOutlined,
  FileAddOutlined,
  InsertRowBelowOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { dove, MsgType } from '../../utils/dove';
import MethodTag from './MethodTag';
import './index.less';

interface YttConfig {
  projectId: number;
  token: string;
}

interface ApiTreeProps {
  configs: YttConfig[];
  onLogout: () => void;
  onRefresh: () => void;
}

interface InterfaceCategory {
  _id: number;
  name: string;
  list: InterfaceItem[];
}

interface InterfaceItem {
  _id: number;
  title: string;
  path: string;
  method: string;
}

interface ProjectData {
  projectId: number;
  name: string;
  categories: InterfaceCategory[];
}

const ApiTree: React.FC<ApiTreeProps> = ({ configs, onLogout, onRefresh }) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadProjects();
  }, [configs]);

  async function loadProjects() {
    setLoading(true);
    try {
      const result: ProjectData[] = [];
      const allCatIds: number[] = [];

      for (const cfg of configs) {
        const projRes = await dove.sendMessage<{
          success: boolean;
          data?: { _id: number; name: string };
          message?: string;
        }>(MsgType.FETCH_PROJECT, { projectId: cfg.projectId, token: cfg.token });

        const projectName = projRes.success && projRes.data
          ? projRes.data.name
          : `项目 ${cfg.projectId}`;

        const menuRes = await dove.sendMessage<{
          success: boolean;
          data?: InterfaceCategory[];
        }>(MsgType.FETCH_INTERFACE_MENU, { projectId: cfg.projectId, token: cfg.token });

        if (menuRes.success && menuRes.data) {
          result.push({
            projectId: cfg.projectId,
            name: projectName,
            categories: menuRes.data,
          });
          menuRes.data.forEach((cat) => allCatIds.push(cat._id));
        }
      }

      setProjects(result);
      setCollapsedCategories(new Set(allCatIds));
    } catch (err: any) {
      message.error('加载项目数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleProject(projectId: number) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  }

  function toggleCategory(catId: number) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  }

  function enterBatchMode() {
    setBatchMode(true);
    setSelectedIds(new Set());
  }

  function exitBatchMode() {
    setBatchMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAction(apiData: InterfaceItem, action: 'copy' | 'insert' | 'show') {
    try {
      const result = await dove.sendMessage<{
        success: boolean;
        data?: { fullCode: string; fnName: string };
        message?: string;
      }>(MsgType.GENERATE_CODE, { id: apiData._id });

      if (!result.success || !result.data) {
        message.error(result.message || '生成代码失败');
        return;
      }

      const { fullCode, fnName } = result.data;
      switch (action) {
        case 'copy':
          await dove.sendMessage(MsgType.COPY_CODE, { code: fullCode });
          break;
        case 'insert':
          await dove.sendMessage(MsgType.INSERT_CODE, { code: fullCode });
          break;
        case 'show':
          await dove.sendMessage(MsgType.SHOW_CODE, { code: fullCode, fileName: `${fnName}.ts` });
          break;
      }
    } catch (err: any) {
      message.error(err.message);
    }
  }

  async function handleBatchGenerate() {
    if (selectedIds.size === 0) {
      message.warning('请先选择接口');
      return;
    }
    try {
      await dove.sendMessage(MsgType.BATCH_GENERATE_CODE, { ids: Array.from(selectedIds) });
    } catch (err: any) {
      message.error(err.message);
    }
    exitBatchMode();
  }

  async function handleEditConfig() {
    await dove.sendMessage(MsgType.EDIT_YTT_CONFIG);
  }

  async function handleLogout() {
    await dove.sendMessage(MsgType.LOGOUT);
    onLogout();
  }

  // Filter logic
  function filterProjects(data: ProjectData[], search: string): ProjectData[] {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data
      .map((proj) => {
        const filteredCats = proj.categories
          .map((cat) => ({
            ...cat,
            list: cat.list.filter(
              (item) =>
                item.title.toLowerCase().includes(lower) ||
                item.path.toLowerCase().includes(lower)
            ),
          }))
          .filter((cat) => cat.list.length > 0);
        return filteredCats.length > 0 ? { ...proj, categories: filteredCats } : null;
      })
      .filter(Boolean) as ProjectData[];
  }

  const contextMenuItems: MenuProps['items'] = [
    { key: 'refresh', icon: <ReloadOutlined />, label: '刷新接口' },
    { key: 'batch', icon: <FileAddOutlined />, label: '批量生成接口' },
  ];

  function handleContextMenuClick({ key }: { key: string }) {
    if (key === 'refresh') loadProjects();
    if (key === 'batch') enterBatchMode();
  }

  const displayData = filterProjects(projects, searchValue);

  if (loading) {
    return (
      <div className="tree-loading">
        <Spin size="large" />
        <span>加载接口数据中...</span>
      </div>
    );
  }

  return (
    <Dropdown
      menu={{ items: contextMenuItems, onClick: handleContextMenuClick }}
      trigger={['contextMenu']}
      disabled={batchMode}
    >
      <div className="api-tree-container">
        {/* Header */}
        <div className="tree-header">
          <div className="toolbar">
            <Input
              className="search-input"
              prefix={<SearchOutlined />}
              placeholder="搜索接口..."
              allowClear
              size="small"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <div className="toolbar-actions">
              <EditOutlined className="toolbar-icon" title="编辑 ytt.json" onClick={handleEditConfig} />
              <ReloadOutlined className="toolbar-icon" title="刷新数据" onClick={() => loadProjects()} />
              <LogoutOutlined className="toolbar-icon" title="退出登录" onClick={handleLogout} />
            </div>
          </div>
        </div>

        {/* Batch mode header */}
        {batchMode && (
          <div className="batch-header">
            <span>已选择 {selectedIds.size} 个接口</span>
            <div className="batch-actions">
              <Button type="primary" size="small" onClick={handleBatchGenerate}>
                批量生成
              </Button>
              <Button size="small" onClick={exitBatchMode}>
                取消
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="tree-content">
          {displayData.length > 0 ? (
            displayData.map((proj) => (
              <div key={proj.projectId} className="project-group">
                <div
                  className="project-header"
                  onClick={() => toggleProject(proj.projectId)}
                >
                  {collapsedProjects.has(proj.projectId) ? (
                    <RightOutlined className="collapse-icon" />
                  ) : (
                    <DownOutlined className="collapse-icon" />
                  )}
                  <span className="project-name">{proj.name}</span>
                </div>

                {!collapsedProjects.has(proj.projectId) &&
                  proj.categories.map((cat) => (
                    <div key={cat._id} className="category-group">
                      <div
                        className="category-header"
                        onClick={() => toggleCategory(cat._id)}
                      >
                        {collapsedCategories.has(cat._id) ? (
                          <RightOutlined className="collapse-icon" />
                        ) : (
                          <DownOutlined className="collapse-icon" />
                        )}
                        <span className="category-name">{cat.name}</span>
                        <span className="category-count">{cat.list.length}</span>
                      </div>

                      {!collapsedCategories.has(cat._id) &&
                        cat.list.map((item) => (
                          <div
                            key={item._id}
                            className={`api-item ${selectedIds.has(item._id) ? 'selected' : ''}`}
                          >
                            {batchMode && (
                              <Checkbox
                                className="api-checkbox"
                                checked={selectedIds.has(item._id)}
                                onChange={() => toggleSelect(item._id)}
                              />
                            )}
                            <MethodTag method={item.method} />
                            <span className="api-title">{item.title}</span>
                            <span className="api-path">{item.path}</span>
                            {!batchMode && (
                              <span className="api-actions">
                                <CopyOutlined
                                  className="action-icon"
                                  title="复制接口定义"
                                  onClick={(e) => { e.stopPropagation(); handleAction(item, 'copy'); }}
                                />
                                <InsertRowBelowOutlined
                                  className="action-icon"
                                  title="插入接口定义到光标"
                                  onClick={(e) => { e.stopPropagation(); handleAction(item, 'insert'); }}
                                />
                                <FileAddOutlined
                                  className="action-icon"
                                  title="生成接口文件"
                                  onClick={(e) => { e.stopPropagation(); handleAction(item, 'show'); }}
                                />
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            ))
          ) : (
            <Empty description="没有找到匹配的接口" style={{ marginTop: 60 }} />
          )}
        </div>
      </div>
    </Dropdown>
  );
};

export default ApiTree;
