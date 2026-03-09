import { yapiGet, yapiPost } from './request';

export interface YapiResponse<T = any> {
  errcode: number;
  errmsg: string;
  data: T;
}

export interface UserInfo {
  _id: number;
  username: string;
  email: string;
  role: string;
}

export interface ProjectInfo {
  _id: number;
  name: string;
  basepath: string;
  desc: string;
  up_time: number;
}

export interface InterfaceCategory {
  _id: number;
  name: string;
  desc: string;
  list: InterfaceItem[];
}

export interface InterfaceItem {
  _id: number;
  title: string;
  path: string;
  method: string;
  status: string;
  up_time: number;
}

export interface InterfaceDetail {
  _id: number;
  title: string;
  path: string;
  method: string;
  req_query: ReqQuery[];
  req_body_form: ReqBodyForm[];
  req_body_other: string;
  req_body_type: string;
  res_body: string;
  res_body_type: string;
  project_id: number;
  catid: number;
  status: string;
  desc: string;
  up_time: number;
}

export interface ReqQuery {
  name: string;
  required: string;
  desc: string;
  example: string;
}

export interface ReqBodyForm {
  name: string;
  type: string;
  required: string;
  desc: string;
  example: string;
}

export async function login(email: string, password: string): Promise<YapiResponse<UserInfo>> {
  return yapiPost('/api/user/login', { email, password });
}

export async function loginByLdap(email: string, password: string): Promise<YapiResponse<UserInfo>> {
  return yapiPost('/api/user/login_by_ldap', { email, password });
}

export async function getLoginStatus(): Promise<YapiResponse<UserInfo>> {
  return yapiGet('/api/user/status');
}

export async function getProjectInfo(projectId: number, token: string): Promise<YapiResponse<ProjectInfo>> {
  return yapiGet('/api/project/get', { id: projectId, token });
}

export async function getInterfaceMenu(projectId: number, token: string): Promise<YapiResponse<InterfaceCategory[]>> {
  return yapiGet('/api/interface/list_menu', { project_id: projectId, token });
}

export async function getInterfaceDetail(id: number): Promise<YapiResponse<InterfaceDetail>> {
  return yapiGet('/api/interface/get', { id });
}

export async function searchInterface(projectId: number, keyword: string): Promise<YapiResponse<InterfaceItem[]>> {
  return yapiGet('/api/interface/list', { project_id: projectId, page: 1, limit: 50, status: 'all' });
}
