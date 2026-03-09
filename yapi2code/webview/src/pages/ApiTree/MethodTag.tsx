import React from 'react';

interface MethodTagProps {
  method: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  DELETE: '#f93e3e',
  PATCH: '#50e3c2',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

const MethodTag: React.FC<MethodTagProps> = ({ method }) => {
  const upper = method.toUpperCase();
  const color = METHOD_COLORS[upper] || '#999';

  return (
    <span
      className="method-tag"
      style={{
        color,
        borderColor: color,
        backgroundColor: `${color}18`,
      }}
    >
      {upper}
    </span>
  );
};

export default MethodTag;
