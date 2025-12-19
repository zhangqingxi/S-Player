/**
 * S-Player - React 应用入口文件
 * 
 * 这个文件是整个 React 应用的起点：
 * 1. 导入 React 和 ReactDOM 用于渲染
 * 2. 导入主组件 App
 * 3. 导入全局样式
 * 4. 将 App 组件渲染到 HTML 中的 #root 元素
 */

import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 创建 React 根节点并渲染 App 组件
// document.getElementById('root') 获取 index.html 中的挂载点
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
