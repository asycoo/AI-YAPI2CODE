import { InterfaceDetail, ReqQuery } from '../services/yapiApi';

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  title?: string;
  enum?: any[];
}

const YAPI_TYPE_MAP: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  null: 'null',
  long: 'string | number',
};

export function getApiName(apiPath: string): string {
  const parts = apiPath
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.replace(/[{}:]/g, ''));

  if (parts.length === 0) return 'unknownApi';

  const last = parts[parts.length - 1];
  const secondLast = parts.length >= 2 ? parts[parts.length - 2] : '';

  const name = secondLast
    ? secondLast + last.charAt(0).toUpperCase() + last.slice(1)
    : last;

  return name.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

function encodeKey(key: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return key;
  }
  return `'${key}'`;
}

function jsonSchemaToType(
  schema: JsonSchema,
  name: string,
  indent: string,
  interfaces: string[]
): string {
  if (!schema || !schema.type) {
    return 'any';
  }

  if (YAPI_TYPE_MAP[schema.type]) {
    return YAPI_TYPE_MAP[schema.type];
  }

  if (schema.type === 'array') {
    if (schema.items) {
      const itemType = jsonSchemaToType(schema.items, `${name}Item`, indent, interfaces);
      return `${itemType}[]`;
    }
    return 'any[]';
  }

  if (schema.type === 'object') {
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      return 'Record<string, any>';
    }

    const interfaceName = `I${name.charAt(0).toUpperCase() + name.slice(1)}`;
    const requiredSet = new Set(schema.required || []);
    const fields: string[] = [];

    for (const [key, prop] of Object.entries(schema.properties)) {
      const optional = requiredSet.has(key) ? '' : '?';
      const desc = prop.description ? `${indent}  /** ${prop.description} */\n` : '';
      const fieldType = jsonSchemaToType(prop, `${name}${key.charAt(0).toUpperCase() + key.slice(1)}`, indent, interfaces);
      fields.push(`${desc}${indent}  ${encodeKey(key)}${optional}: ${fieldType};`);
    }

    interfaces.push(`export interface ${interfaceName} {\n${fields.join('\n')}\n}`);
    return interfaceName;
  }

  return 'any';
}

function genReqQueryType(fnName: string, reqQuery: ReqQuery[]): string {
  if (!reqQuery || reqQuery.length === 0) return '';

  const interfaceName = `I${fnName.charAt(0).toUpperCase() + fnName.slice(1)}ReqQuery`;
  const fields = reqQuery.map((q) => {
    const desc = q.desc ? `  /** ${q.desc} */\n` : '';
    const optional = q.required === '1' ? '' : '?';
    return `${desc}  ${encodeKey(q.name)}${optional}: string;`;
  });

  return `export interface ${interfaceName} {\n${fields.join('\n')}\n}`;
}

function genReqBodyType(fnName: string, reqBodyOther: string): string {
  if (!reqBodyOther) return '';

  try {
    const schema: JsonSchema = JSON.parse(reqBodyOther);
    const interfaces: string[] = [];
    const typeName = `${fnName}ReqBody`;
    jsonSchemaToType(schema, typeName, '', interfaces);
    return interfaces.join('\n\n');
  } catch {
    return '';
  }
}

function genResBodyType(fnName: string, resBody: string): string {
  if (!resBody) return '';

  try {
    const schema: JsonSchema = JSON.parse(resBody);
    const interfaces: string[] = [];
    const typeName = `${fnName}ResBody`;
    jsonSchemaToType(schema, typeName, '', interfaces);
    return interfaces.join('\n\n');
  } catch {
    return '';
  }
}

function genResDataType(fnName: string, resBody: string): string {
  if (!resBody) return '';

  try {
    const schema: JsonSchema = JSON.parse(resBody);
    if (schema.type === 'object' && schema.properties?.data) {
      const interfaces: string[] = [];
      const typeName = `${fnName}ResData`;
      jsonSchemaToType(schema.properties.data, typeName, '', interfaces);
      return interfaces.join('\n\n');
    }
    return '';
  } catch {
    return '';
  }
}

export interface GeneratedCode {
  fnName: string;
  reqQueryType: string;
  reqBodyType: string;
  resBodyType: string;
  resDataType: string;
  requestFn: string;
  fullCode: string;
}

export function generateCode(
  detail: InterfaceDetail,
  importStatement: string
): GeneratedCode {
  const fnName = getApiName(detail.path);
  const reqQueryType = genReqQueryType(fnName, detail.req_query);
  const reqBodyType = genReqBodyType(fnName, detail.req_body_other);
  const resBodyType = genResBodyType(fnName, detail.res_body);
  const resDataType = genResDataType(fnName, detail.res_body);

  const method = detail.method.toLowerCase();
  const FnName = fnName.charAt(0).toUpperCase() + fnName.slice(1);

  let paramsDef = '';
  let paramsUsage = '';
  let returnType = resDataType
    ? `I${FnName}ResData`
    : resBodyType
    ? `I${FnName}ResBody`
    : 'any';

  if (method === 'get' && reqQueryType) {
    paramsDef = `params: I${FnName}ReqQuery`;
    paramsUsage = ', { params }';
  } else if (reqBodyType) {
    paramsDef = `data: I${FnName}ReqBody`;
    paramsUsage = ', data';
  } else if (reqQueryType) {
    paramsDef = `params: I${FnName}ReqQuery`;
    paramsUsage = method === 'get' ? ', { params }' : ', params';
  }

  const requestFn = [
    `/**`,
    ` * ${detail.title}`,
    ` * @method ${detail.method}`,
    ` * @path ${detail.path}`,
    ` */`,
    `export async function ${fnName}(${paramsDef}): Promise<${returnType}> {`,
    `  return request.${method}('${detail.path}'${paramsUsage});`,
    `}`,
  ].join('\n');

  const parts = [importStatement, ''];
  if (reqQueryType) parts.push(reqQueryType, '');
  if (reqBodyType) parts.push(reqBodyType, '');
  if (resDataType) {
    parts.push(resDataType, '');
  } else if (resBodyType) {
    parts.push(resBodyType, '');
  }
  parts.push(requestFn, '');

  return {
    fnName,
    reqQueryType,
    reqBodyType,
    resBodyType,
    resDataType,
    requestFn,
    fullCode: parts.join('\n'),
  };
}
