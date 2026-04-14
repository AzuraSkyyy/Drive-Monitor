/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder, 
  File, 
  RefreshCw, 
  ExternalLink, 
  LogOut, 
  Activity, 
  Search, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Settings,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  iconLink: string;
  webViewLink: string;
}

interface ActivityLog {
  id: string;
  type: string;
  timestamp: string;
  details: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [folderId, setFolderId] = useState('1iAKaCVwYlqtwi0iSacMLk-0o3ddZ08Jg');
  const [inputUrl, setInputUrl] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch (err) {
      console.error('Auth check failed', err);
      setIsAuthenticated(false);
    }
  };

  const fetchFiles = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drive/files?folderId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        addLog('Sync', `Successfully fetched ${data.length} items from folder.`);
      } else {
        addLog('Error', 'Failed to fetch files. Check permissions.');
      }
    } catch (err) {
      addLog('Error', 'Network error while fetching files.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addLog = (type: string, details: string) => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      timestamp: new Date().toLocaleTimeString(),
      details
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles(folderId);
      
      const newSocket = io();
      setSocket(newSocket);

      newSocket.on('drive_change', (data) => {
        addLog('Update', `Change detected: ${data.state}`);
        fetchFiles(folderId); // Refresh on change
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, folderId, fetchFiles]);

  const handleLogin = async () => {
    const res = await fetch('/api/auth/url');
    const { url } = await res.json();
    const width = 600, height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    const authWindow = window.open(
      url,
      'google_auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        window.removeEventListener('message', messageHandler);
      }
    };
    window.addEventListener('message', messageHandler);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setFiles([]);
  };

  const handleUpdateFolder = () => {
    // Extract ID from URL if necessary
    let id = inputUrl;
    const match = inputUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
    if (match) id = match[1];
    
    if (id) {
      setFolderId(id);
      addLog('Config', `Target folder changed to: ${id}`);
    }
  };

  const startMonitoring = async () => {
    try {
      const res = await fetch('/api/drive/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      });
      if (res.ok) {
        setIsMonitoring(true);
        addLog('Monitor', 'Real-time push notifications established.');
      } else {
        addLog('Warning', 'Push notifications setup failed. Falling back to manual sync.');
      }
    } catch (err) {
      addLog('Error', 'Failed to initialize monitoring.');
    }
  };

  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#141414] border border-[#262626] rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="text-blue-500 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">DriveWatch</h1>
          <p className="text-gray-400 mb-8">
            Connect your Google account to monitor folder changes in real-time.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-sans selection:bg-blue-500/30">
      {/* Sidebar / Header */}
      <header className="border-b border-[#1a1a1a] bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="text-white font-bold tracking-tight">DriveWatch</span>
            <div className="ml-4 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[10px] text-green-500 font-mono uppercase tracking-wider">
              Live
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchFiles(folderId)}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Manual Sync"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Controls & Feed */}
        <div className="lg:col-span-4 space-y-6">
          {/* Folder Config */}
          <section className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Settings className="w-3 h-3" />
              Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Folder URL or ID</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Paste Drive link..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="flex-1 bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button 
                    onClick={handleUpdateFolder}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={startMonitoring}
                  disabled={isMonitoring}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    isMonitoring 
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-default' 
                    : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {isMonitoring ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  {isMonitoring ? 'Monitoring Active' : 'Enable Push Notifications'}
                </button>
              </div>
            </div>
          </section>

          {/* Activity Log */}
          <section className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5 flex flex-col h-[500px]">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Activity Stream
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-[#141414] border-l-2 border-blue-500 rounded-r-lg"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-mono text-blue-400 uppercase">{log.type}</span>
                      <span className="text-[10px] text-gray-600">{log.timestamp}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{log.details}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic text-sm">
                  Waiting for activity...
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: File Grid */}
        <div className="lg:col-span-8">
          <section className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="p-5 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0d0d0d]">
              <div className="flex items-center gap-3">
                <Folder className="text-blue-500 w-5 h-5" />
                <h2 className="text-white font-semibold">Folder Contents</h2>
                <span className="text-xs text-gray-500 font-mono">ID: {folderId.slice(0, 8)}...</span>
              </div>
              <div className="text-xs text-gray-500">
                {files.length} items found
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0d0d0d] border-b border-[#1a1a1a]">
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Modified</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {files.map(file => (
                    <tr key={file.id} className="hover:bg-[#141414] transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img src={file.iconLink} className="w-4 h-4 opacity-70" alt="" referrerPolicy="no-referrer" />
                          <span className="text-sm text-gray-200 font-medium truncate max-w-[200px]">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 font-mono">
                        {new Date(file.modifiedTime).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[10px] px-2 py-0.5 bg-[#1a1a1a] rounded text-gray-400 font-mono">
                          {file.mimeType.split('.').pop()?.split('/').pop()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <a 
                          href={file.webViewLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-5 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-600">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <p className="text-sm italic">No files found in this directory.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={4} className="px-5 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                          <p className="text-sm text-gray-500">Syncing with Drive...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #262626;
        }
      `}} />
    </div>
  );
}
